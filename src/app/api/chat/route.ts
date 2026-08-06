import { streamChatCompletion } from "@/lib/llm";
import { buildSystemPrompt, extractTimingStatements } from "@/lib/prompt";
import { computeTransits } from "@/lib/transit";
import { classifyTopic, getChartFocus } from "@/lib/routing";
import { retrieveVedicContext } from "@/lib/rag";
import { needsReflection, reflectOnAnswer } from "@/lib/reflection";
import { detectCrisis, crisisReply } from "@/lib/safety";
import { updateChatSummary } from "@/lib/summarize";
import { ashtakoota } from "@/lib/ashtakoota";
import { getSupabaseAdmin } from "@/lib/supabase";
import { newUuid } from "@/lib/storage";
import type { ChatMessage, KundliResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sentinel the client watches for to replace the streamed draft. */
export const REFINE_MARKER = "\n[[REFINED]]\n";

/** How much recent conversation to send to the model (keeps context, limits cost). */
const HISTORY_WINDOW = 30;

/** Minimum answer length before we consider a stream a silent failure. */
const MIN_DRAFT = 20;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return new Response("invalid_json", { status: 400 });

  const { kundli, messages, lang, chatId, messageId, matchKundli }: {
    kundli: KundliResult;
    messages: ChatMessage[];
    lang: string;
    chatId?: string;
    messageId?: string;
    matchKundli?: KundliResult;
  } = body;

  if (!kundli || !Array.isArray(messages) || messages.length === 0) {
    return new Response("missing_chat_payload", { status: 400 });
  }

  // Safety guard: crisis/self-harm input → caring reply, no LLM call.
  const latestUser = messages[messages.length - 1];
  if (latestUser?.role === "user" && detectCrisis(latestUser.content)) {
    const reply = crisisReply(lang ?? "en");
    return new Response(reply, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const now = new Date();
  const deviceId = request.headers.get("x-device-id") ?? "-";

  // 1) Topic routing node: classify the latest question → focus factors.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const topic = classifyTopic(lastUser?.content ?? "");
  const focus = getChartFocus(topic);
  console.log(
    `[aryad] topic=${topic} houses=[${focus.houses.join(",")}] planets=[${focus.planetIds.join(",")}]`
  );

  // 2) Tool node: real gochar positions for today.
  const transits = await computeTransits(now).catch(() => undefined);

  // 3) RAG node: retrieve authoritative Vedic knowledge for this topic/chart.
  const vedicChunks = retrieveVedicContext({ focus, kundli });

  // Optional kundli-matching: score both charts and ground the answer in both.
  let matchCtx: { kundli: KundliResult; score: ReturnType<typeof ashtakoota> } | undefined;
  if (matchKundli && matchKundli.computed) {
    try {
      matchCtx = {
        kundli: matchKundli,
        score: ashtakoota(
          {
            moonRashi: kundli.computed.moonRashi,
            moonNakshatra: kundli.computed.moonNakshatra,
            moonNakshatraPad: kundli.computed.moonNakshatraPad,
          },
          {
            moonRashi: matchKundli.computed.moonRashi,
            moonNakshatra: matchKundli.computed.moonNakshatra,
            moonNakshatraPad: matchKundli.computed.moonNakshatraPad,
          }
        ),
      };
    } catch (err) {
      console.warn("[aryad] match scoring failed:", (err as Error).message);
    }
  }

  const system = buildSystemPrompt(
    kundli,
    lang ?? "en",
    now,
    transits,
    focus,
    vedicChunks,
    matchCtx
  );

  // Keep prior timing windows visible even when history is truncated.
  // Prefer the FULL stored thread (cross-session memory) over just the
  // messages the client sent in this request.
  const storedHistory = await loadStoredHistory(deviceId, chatId).catch(() => null);
  const historyForContext = storedHistory && storedHistory.length > 0
    ? storedHistory
    : messages;
  const priorWindows = extractTimingStatements(historyForContext);
  const memory = await loadMemory(deviceId).catch(() => null);
  let systemWithHistory =
    system +
    (priorWindows
      ? `\n\nPREVIOUS TIMING STATEMENTS (these are windows you ALREADY gave this user, possibly in an earlier visit. You MUST repeat them verbatim when re-asked; never give a different month/year):\n${priorWindows}`
      : "");
  if (memory?.summary) {
    systemWithHistory += `\n\nEARLIER CONVERSATION MEMORY (a concise summary of the topics and the user's situation from before; it is context only — timing windows above are authoritative and must never be contradicted):\n${memory.summary}`;
  }

  // With a memory summary present we can trim the verbatim window to save cost.
  const windowSize = memory?.summary ? 20 : HISTORY_WINDOW;
  const llmMessages = [
    { role: "system" as const, content: systemWithHistory },
    ...messages.slice(-windowSize).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let draft = "";

      // 4) Compose node: stream Arya's draft answer.
      //    `live` streams tokens to the client; retries buffer silently so a
      //    failed attempt can't leave a half-written/empty bubble behind.
      const attempt = async (live: boolean) => {
        await streamChatCompletion({
          messages: llmMessages,
          onToken: (token) => {
            draft += token;
            if (live) controller.enqueue(encoder.encode(token));
          },
          onUsage: (u) => {
            console.log(
              `[aryad] device=${deviceId} model=${process.env.LLM_MODEL ?? "-"} ` +
                `prompt=${u.promptTokens} cached=${u.cachedTokens} ` +
                `completion=${u.completionTokens} reasoning=${u.reasoningTokens} total=${u.totalTokens}`
            );
          },
        });
      };

      try {
        await attempt(true);
      } catch (err) {
        console.warn("[aryad] compose attempt 1 failed:", (err as Error).message);
        draft = "";
      }

      if (draft.trim().length < MIN_DRAFT) {
        console.warn(
          `[aryad] draft too short (${draft.length} chars), retrying silently`
        );
        draft = "";
        try {
          await attempt(false);
        } catch (err) {
          console.warn("[aryad] retry failed:", (err as Error).message);
          draft = "";
        }
      }

      if (draft.trim().length < MIN_DRAFT) {
        draft = "Hmm, the stars got a bit tangled there 🙏 Mind asking that again?";
        controller.enqueue(encoder.encode(draft));
      }

      // 5) Reflection node: fact-check the draft against the real chart.
      let final = draft;
      const reflectionOn =
        (process.env.LLM_REFLECTION ?? "on").toLowerCase() !== "off";
      if (reflectionOn && needsReflection(draft)) {
        const result = await reflectOnAnswer({
          draft,
          kundli,
          focus,
          lang: lang ?? "en",
        }).catch(() => ({ corrected: false, text: "" }));

        if (result.corrected && result.text) {
          final = result.text;
          console.log(
            `[aryad] device=${deviceId} reflection=corrected (${draft.length}->${result.text.length} chars)`
          );
          controller.enqueue(encoder.encode(REFINE_MARKER));
          controller.enqueue(encoder.encode(result.text));
        } else {
          console.log(`[aryad] device=${deviceId} reflection=clean`);
        }
      }

      // 6) Persistence node: save chat + messages when Supabase is configured.
      await persistExchange({
        deviceId,
        chatId,
        messageId,
        lang: lang ?? "en",
        userMessage: messages[messages.length - 1]?.content ?? "",
        assistantMessage: final,
      });

      // 7) Memory node: refresh the situational summary on long threads
      // (rare — every ~10 exchanges, threads ≥ 20 messages).
      await maybeRefreshSummary(deviceId, lang ?? "en").catch(() => null);

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Loads the user's full stored thread so prior predictions stay consistent across sessions. */
async function loadMemory(deviceId: string): Promise<{ summary: string | null } | null> {
  const admin = getSupabaseAdmin();
  if (!admin || deviceId === "-") return null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("chat_summary")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!data?.chat_summary) return null;
    return { summary: data.chat_summary };
  } catch {
    return null;
  }
}

/**
 * Refreshes the tier-3 situational summary when a long thread has grown enough.
 * Non-fatal and cheap — skips short threads and refreshes only every ~10 messages.
 */
async function maybeRefreshSummary(deviceId: string, lang: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || deviceId === "-") return;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id,chat_summary,chat_summary_count")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!profile?.id) return;

    const { data: chat } = await admin
      .from("chats")
      .select("id")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chat?.id) return;

    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chat.id);
    const total = count ?? 0;
    if (total < 20) return; // too short to summarize
    const last = profile.chat_summary_count ?? 0;
    if (profile.chat_summary && total - last < 10) return; // refreshed recently

    const { data: msgs } = await admin
      .from("messages")
      .select("role,content")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false })
      .limit(12);
    const recent = [...(msgs ?? [])].reverse();

    const summary = await updateChatSummary({
      existing: profile.chat_summary,
      recent,
      lang,
    });
    if (summary) {
      await admin
        .from("profiles")
        .update({ chat_summary: summary, chat_summary_count: total })
        .eq("id", profile.id);
      console.log(`[aryad] device=${deviceId} memory refreshed at ${total} messages`);
    }
  } catch (err) {
    console.warn("[supabase] memory update skipped:", (err as Error).message);
  }
}

/** Loads the user's full stored thread so prior predictions stay consistent across sessions. */
async function loadStoredHistory(
  deviceId: string,
  chatId?: string
): Promise<{ role: string; content: string }[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin || deviceId === "-") return null;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!profile) return null;

    const cid = chatId ?? newUuid();
    const { data } = await admin
      .from("messages")
      .select("role,content")
      .eq("chat_id", cid)
      .order("created_at", { ascending: true })
      .limit(120);
    if (!data || data.length === 0) return null;
    return data.filter((m) => m.role === "user" || m.role === "assistant");
  } catch (err) {
    console.warn("[supabase] history load skipped:", (err as Error).message);
    return null;
  }
}

/** Server-side persistence of one user→Arya exchange (non-fatal). */
async function persistExchange(params: {
  deviceId: string;
  chatId?: string;
  messageId?: string;
  lang: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || params.deviceId === "-" || !params.userMessage) return;

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("device_id", params.deviceId)
      .maybeSingle();
    if (!profile) return; // no profile yet (kundli not generated)

    const cid = params.chatId ?? newUuid();
    await admin
      .from("chats")
      .upsert({ id: cid, profile_id: profile.id, lang: params.lang }, { onConflict: "id" });

    await admin
      .from("messages")
      .upsert(
        {
          id: params.messageId ?? newUuid(),
          chat_id: cid,
          role: "user",
          content: params.userMessage,
        },
        { onConflict: "id" }
      );

    await admin
      .from("messages")
      .upsert(
        { id: newUuid(), chat_id: cid, role: "assistant", content: params.assistantMessage },
        { onConflict: "id" }
      );
  } catch (err) {
    console.warn("[supabase] chat persist skipped:", (err as Error).message);
  }
}
