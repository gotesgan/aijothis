import type { KundliResult } from "./types";
import type { ChartFocus } from "./routing";
import { chatCompletion } from "./llm";
import { NAKSHATRA_NAMES, RASHI_NAMES } from "./kundli";

const CLAIM_PATTERN =
  /\b(house|transit|mahadasha|dasha|\d+st\b|\d+nd\b|\d+rd\b|\d+th\b|°|भाव|दशा|राशी|राशि)\b/i;

/**
 * Reflection node (lightweight gate).
 *
 * Only runs when the draft makes specific chart claims (houses, transits,
 * Dashas, signs). A second, cheaper LLM pass fact-checks the draft against
 * the real chart data and returns a corrected answer if needed.
 */
export function needsReflection(draft: string): boolean {
  return draft.length > 40 && CLAIM_PATTERN.test(draft);
}

export async function reflectOnAnswer(params: {
  draft: string;
  kundli: KundliResult;
  focus: ChartFocus;
  lang: string;
  signal?: AbortSignal;
}): Promise<{ corrected: boolean; text: string }> {
  const { draft, kundli, focus, lang } = params;
  const c = kundli.computed;
  const current = kundli.dasha.periods.find((p) => p.current);

  const chartFacts = [
    `Name: ${kundli.profile.name || "the user"}`,
    `Lagna: ${RASHI_NAMES[c.lagnaRashi]}`,
    `Moon: ${RASHI_NAMES[c.moonRashi]} (${NAKSHATRA_NAMES[c.moonNakshatra]})`,
    `Sun: ${RASHI_NAMES[c.sunRashi]}`,
    ...kundli.planets.map(
      (p) => `${p.name}: ${RASHI_NAMES[p.rashi]}, ${p.house}${ordinal(p.house)} house${p.retrograde ? " (retro)" : ""}`
    ),
    `Current Mahadasha: ${current ? `${current.lord} until ${current.end}` : "unknown"}`,
    `Focus area: ${focus.topic}`,
  ].join("\n");

  const prompt = `You are a strict Vedic astrology fact-checker. Verify every specific claim in the DRAFT against the CHART FACTS (house numbers, signs, planets, Dashas, transits). Do NOT change style, tone, length, language (${lang}), or the closing question.

Return ONLY a JSON object, no markdown:
{"corrected": true|false, "text": "..."}
- corrected=false, text="" if the draft is accurate or only makes safe/general statements.
- corrected=true, text=<the corrected answer> only if a specific factual claim is wrong or unsupported by the chart facts. Fix only the errors; keep the rest identical.

CHART FACTS:
${chartFacts}

DRAFT:
${draft}`;

  try {
    const { text, usage } = await chatCompletion({
      messages: [
        { role: "system", content: "You are a precise, conservative astrology fact-checker." },
        { role: "user", content: prompt },
      ],
      maxTokens: 2048,
      signal: params.signal,
    });

    if (usage) {
      console.log(
        `[aryad] reflection prompt=${usage.promptTokens} cached=${usage.cachedTokens} ` +
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
