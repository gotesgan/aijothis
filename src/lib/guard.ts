import type { KundliResult } from "./types";
import type { ChartFocus } from "./routing";
import { chatCompletion } from "./llm";
import { NAKSHATRA_NAMES, RASHI_NAMES } from "./kundli";

/**
 * Guard agent — the dedicated safety layer of the chat pipeline.
 *
 * Two touchpoints, one focused module, cheap calls:
 *
 *  1. guardInput  — a tiny classifier on every user message. Returns:
 *       - "crisis"  → hard crisis reply, no LLM answer (catches paraphrased
 *                     self-harm that the free regex in safety.ts misses)
 *       - "soften"  → this message is third-party fixation / paranoid
 *                     interpretation; the caller injects `note` into the
 *                     system prompt so Arya de-escalates instead of feeding it
 *       - "pass"    → normal question, continue as usual
 *
 *  2. guardOutput — reviews the composed draft (replaces the old reflection
 *     node) and fixes, in ONE pass:
 *       - chart-fact errors (houses/planets/dashas/transits vs the real chart)
 *       - dasha-end-year bleed ("growth until 2044")
 *       - fabricated quotes/thoughts about real, named people
 *       - paranoid amplification (blackmail/spying/black magic/conspiracies)
 */

/* ── Gating ─────────────────────────────────────────────────────────── */

const CLAIM_PATTERN =
  /\b(house|transit|mahadasha|dasha|\d+st\b|\d+nd\b|\d+rd\b|\d+th\b|°|भाव|दशा|राशी|राशि)\b/i;

/** Output guard only runs on substantive drafts with chart claims. */
export function needsGuard(draft: string): boolean {
  return draft.length > 40 && CLAIM_PATTERN.test(draft);
}

/* ── Input guard ─────────────────────────────────────────────────────── */

export type GuardAction = "pass" | "crisis" | "soften";

export interface GuardInputResult {
  action: GuardAction;
  /** Directive appended to the system prompt when action === "soften". */
  note?: string;
}

const SOFTEN_NOTE =
  "GUARD DIRECTIVE: This user is intensely focused on what OTHER people think, feel, say or plan (suspicion, jealousy, spying, blackmail, black magic by others, everyone-talking-about-me). Answer with warmth, but: never confirm suspicions as fact; never invent what a real person thinks or says; frame any reading around what the USER can control (their peace, their real relationships, their wellbeing); if they keep repeating the same fixation, gently broaden to their own life. Suggest professional support (a counsellor) if the fear or suspicion is intense or repeated.";

const GUARD_INPUT_SYSTEM =
  "You are a safety guard for a Vedic astrology chat app. Classify the user's message. Return ONLY a JSON object with one key, \"action\", whose value is one of: \"crisis\", \"soften\", \"pass\".\n" +
  "- \"crisis\": self-harm, suicide, or immediate danger to the user or others; severe distress needing a helpline.\n" +
  "- \"soften\": the user is intensely focused on what OTHER specific people think/feel/do — jealousy, suspicion of spying, blackmail, black magic/harm by others, \"everyone is talking about me\", or the same fixation repeated obsessively. Emotional relationship questions on their own are NOT soften.\n" +
  "- \"pass\": everything else, including normal astrology questions and ordinary emotional questions.";

/** Cheap classifier run on every user message (max ~30 output tokens). */
export async function guardInput(
  question: string,
  lang: string
): Promise<GuardInputResult> {
  if (!question || question.trim().length < 8) return { action: "pass" };
  try {
    const { text } = await chatCompletion({
      messages: [
        { role: "system", content: GUARD_INPUT_SYSTEM },
        {
          role: "user",
          content: `Message (language: ${lang}):\n${question.slice(0, 600)}`,
        },
      ],
      maxTokens: 30,
    });
    const match = text.match(/\{"action"\s*:\s*"(crisis|soften|pass)"/);
    const action = (match?.[1] as GuardAction | undefined) ?? "pass";
    return action === "soften" ? { action, note: SOFTEN_NOTE } : { action };
  } catch {
    return { action: "pass" };
  }
}

/* ── Output guard ────────────────────────────────────────────────────── */

export interface GuardOutputResult {
  corrected: boolean;
  text: string;
}

/**
 * Reviews a composed draft in one pass: chart facts, dasha-end bleed,
 * fabricated third-party claims, and paranoid amplification.
 */
export async function guardOutput(params: {
  draft: string;
  kundli: KundliResult;
  focus: ChartFocus;
  lang: string;
  signal?: AbortSignal;
}): Promise<GuardOutputResult> {
  const { draft, kundli, focus, lang } = params;
  const c = kundli.computed;
  const current = kundli.dasha.periods.find((p) => p.current);

  const chartFacts = [
    `Name: ${kundli.profile.name || "the user"}`,
    `Lagna: ${RASHI_NAMES[c.lagnaRashi]}`,
    `Moon: ${RASHI_NAMES[c.moonRashi]} (${NAKSHATRA_NAMES[c.moonNakshatra]})`,
    `Sun: ${RASHI_NAMES[c.sunRashi]}`,
    ...kundli.planets.map(
      (p) =>
        `${p.name}: ${RASHI_NAMES[p.rashi]}, ${p.house}${ordinal(p.house)} house${p.retrograde ? " (retro)" : ""}`
    ),
    `Current Mahadasha: ${current ? `${current.lord} until ${current.end}` : "unknown"}`,
    `Focus area: ${focus.topic}`,
  ].join("\n");

  const prompt = `You are a strict review guard for an AI Vedic astrology assistant. Review the DRAFT against the CHART FACTS and the RULES below. Do NOT change style, tone, length, language (${lang}), or the closing question — keep the answer as close to the original as possible, fixing only violations.

Return ONLY a JSON object, no markdown:
{"corrected": true|false, "text": "..."}
- corrected=false, text="" if the draft is fine.
- corrected=true, text=<the corrected answer> only if a violation below needs fixing. Fix only the violations; keep everything else identical.

RULES:
1. FACT-CHECK: verify every house/planet/sign/Dasha/transit claim against the CHART FACTS. Fix any claim that is wrong or unsupported.
2. NEVER state a Mahadasha end-date (e.g. "until 2044") as if it were a prediction window or an outcome horizon. Rewrite those so the end-date is not presented as a forecast.
3. NEVER invent what a real, named person thinks, feels, says or plans — no fabricated quotes ("she told him...", "he secretly thinks...", "Freda said you are..."). Rewrite such claims as hedged possibilities from the chart: "the chart suggests he may be...", never a definite fact about another person's mind.
4. Do NOT confirm or amplify paranoid interpretations (blackmail, spying, black magic, conspiracies, "everyone is talking about me"). Rewrite to acknowledge the worry warmly, then re-anchor to what the USER controls — their own peace, their real relationships, their wellbeing.
5. If the user's same fixation is repeated, gently broaden the answer to the user's own life instead of feeding the fixation.

CHART FACTS:
${chartFacts}

DRAFT:
${draft}`;

  try {
    const { text, usage } = await chatCompletion({
      messages: [
        { role: "system", content: "You are a precise, conservative review guard." },
        { role: "user", content: prompt },
      ],
      maxTokens: 2048,
      signal: params.signal,
    });

    if (usage) {
      console.log(
        `[aryad] guardOutput prompt=${usage.promptTokens} cached=${usage.cachedTokens} ` +
          `completion=${usage.completionTokens} reasoning=${usage.reasoningTokens} total=${usage.totalTokens}`
      );
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { corrected: false, text: "" };

    const parsed = JSON.parse(match[0]) as { corrected?: boolean; text?: string };
    const corrected = parsed.corrected === true;
    const refined = (parsed.text ?? "").trim();

    // Guard: never replace with something empty or degenerate.
    if (!corrected || refined.length < 20 || refined === draft.trim()) {
      return { corrected: false, text: "" };
    }
    return { corrected: true, text: refined };
  } catch {
    return { corrected: false, text: "" };
  }
}

function ordinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}
