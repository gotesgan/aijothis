import { streamChatCompletion } from "@/lib/llm";
import { buildSystemPrompt, extractTimingStatements } from "@/lib/prompt";
import { computeTransits } from "@/lib/transit";
import { classifyTopic, getChartFocus } from "@/lib/routing";
import { retrieveVedicContext } from "@/lib/rag";
import { needsReflection, reflectOnAnswer } from "@/lib/reflection";
import { detectCrisis, crisisReply } from "@/lib/safety";
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

  const { kundli, messages, lang, chatId, messageId }: {
    kundli: KundliResult;
    messages: ChatMessage[];
    lang: string;
    chatId?: string;
    messageId?: string;
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

  const system = buildSystemPrompt(
    kundli,
    lang ?? "en",
    now,
    transits,
    focus,
    vedicChunks
  );

  // Keep prior timing windows visible even when history is truncated.
  const priorWindows = extractTimingStatements(messages);
  const systemWithHistory =
    system +
    (priorWindows
      ? `\n\nPREVIOUS TIMING STATEMENTS FROM THIS CHAT (you MUST stay consistent with these — if the user asks for timing again, repeat the most recent relevant window and only add detail, never a different month/year):\n${priorWindows}`
      : "");

  const llmMessages = [
    { role: "system" as const, content: systemWithHistory },
    ...messages.slice(-HISTORY_WINDOW).map((m) => ({
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

/** Server-side persistence of one user→Arya exchange (non-fatal). */async function persistExchange(params: {
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
