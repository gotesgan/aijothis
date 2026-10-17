/**
 * Server-only half of the marriage report: purchase checks and the LLM-written
 * narrative. Kept apart from @/lib/report so the pure facts module stays free
 * of `node`/LLM imports and can be shared with the client bundle.
 */
import { getSupabaseAdmin } from "@/lib/supabase";
import { chatCompletion } from "@/lib/llm";
import {
  buildFacts,
  FULL_REPORT_SECTIONS,
  isReportPackId,
  type FullReportSectionId,
  type ReportFacts,
  type ReportSection,
} from "@/lib/report";
import { RASHI_NAMES, NAKSHATRA_NAMES } from "@/lib/kundli";
import type { KundliResult } from "@/lib/types";

/** Has this device ever settled a marriage-report order? */
export async function hasReportPurchase(deviceId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin || !deviceId) return false;
  try {
    const { data, error } = await admin
      .from("orders")
      .select("pack_id, status")
      .eq("device_id", deviceId)
      .in("status", ["paid", "simulated"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      // Fail CLOSED here: this gate unlocks a paid product, so a DB error must
      // not hand it out. (Contrast the chat quota, which fails open so a paying
      // customer is never locked out — there the risk is inverted.)
      console.warn("[report] purchase check failed:", error.message);
      return false;
    }
    return (data ?? []).some((row) => isReportPackId(row.pack_id));
  } catch (err) {
    console.warn("[report] purchase check skipped:", (err as Error).message);
    return false;
  }
}

const LANGUAGE: Record<string, string> = {
  en: "English",
  hi: "Hindi (Devanagari script)",
  mr: "Marathi (Devanagari script)",
};

/** Compact, model-readable summary of the placements that matter for marriage. */
function chartBrief(f: ReportFacts): string {
  const rashi = (i: number) => RASHI_NAMES[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA_NAMES[i] ?? String(i);
  const seven = f.planetsInSeventh.length
    ? f.planetsInSeventh.join(", ")
    : "none";
  return [
    `Lagna (ascendant): ${rashi(f.lagna)}`,
    `Moon sign: ${rashi(f.moonRashi)}; Nakshatra: ${nak(f.moonNakshatra)}, pada ${f.moonNakshatraPad}`,
    `Sun sign: ${rashi(f.sunRashi)}`,
    `7th house (marriage) sign: ${rashi(f.seventhSign)}`,
    `7th lord: ${f.seventhLord} in house ${f.seventhLordHouse}`,
    `Planets in the 7th house: ${seven}`,
    `Venus (wife/partner karaka): ${rashi(f.venusSign)}, house ${f.venusHouse}`,
    `Jupiter (husband/values karaka): ${rashi(f.jupiterSign)}, house ${f.jupiterHouse}`,
    `Mars in house ${f.marsHouse} → Mangal dosha: ${f.mangalDosha === true ? "present" : f.mangalDosha === "mild" ? "mild (from Moon only)" : "not indicated"}`,
    `Current Vimshottari dasha: ${f.currentDashaLord} until ${f.currentDashaEnd}`,
  ].join("\n");
}

const SYSTEM = `You are a careful Vedic (Jyotish) astrologer writing a PAID marriage report.
Rules you must follow:
- Ground EVERY claim in the exact placements given. Name the sign, house or lord you are reading from. Never write a sentence that would fit any chart.
- Be specific and practical, in plain warm language. No filler, no "you are a unique person", no generic horoscope lines.
- You MAY give timing windows from the Vimshottari dasha and the 7th-house/lord, but never invent exact dates or guarantees.
- Be honest about difficulties; give constructive, non-fear-based remedies.
- Do not give medical, legal or financial guarantees. This is guidance for reflection.
- Write in the requested language only.
- Return ONLY valid JSON, no markdown fences.`;

function buildPrompt(f: ReportFacts, locale: string): string {
  const lang = LANGUAGE[locale] ?? "English";
  const list = FULL_REPORT_SECTIONS.join(", ");
  return [
    `Write a marriage report in ${lang}.`,
    "",
    "Chart placements (sidereal, Lahiri, whole-sign houses):",
    chartBrief(f),
    "",
    `Return a JSON object: {"sections":[{"id":"<id>","body":"<text>"}]} with EXACTLY these ids in order: ${list}.`,
    "Each body must be 110–170 words of flowing prose (2 short paragraphs).",
    "Section intent:",
    "- timing: strongest marriage windows implied by the current and next dasha, and what the 7th lord's house says about readiness.",
    "- partner: the kind of partner indicated by the 7th house sign, its lord, and planets in the 7th.",
    "- venusJupiter: what Venus and Jupiter placements say about affection, values and expectations in marriage.",
    "- doshas: Mangal dosha verdict (state clearly if it is absent), and any other caution, without fear-mongering.",
    "- marriedLife: how married life and communication are likely to feel, from the 7th house and its lord.",
    "- finance: money, home and family life after marriage.",
    "- remedies: 4–6 concrete, simple, practical remedies (mantra, charity, routine, behaviour) tied to the placements.",
    "- conclusion: a balanced closing verdict and one sentence of honest direction.",
  ].join("\n");
}

/** Parse the model's JSON, tolerating fences and surrounding prose. */
function parseSections(raw: string): ReportSection[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      sections?: { id?: string; body?: string }[];
    };
    const sections = (parsed.sections ?? [])
      .filter((s) => s && typeof s.body === "string" && s.body.trim())
      .map((s) => ({ id: String(s.id ?? ""), body: String(s.body).trim() }));
    return sections.length >= 4 ? sections : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback so a PAYING customer is never left with an empty
 * report if the model errors, times out, or returns junk. Not as deep as the
 * LLM narrative, but chart-specific and complete.
 */
function fallbackSections(f: ReportFacts): ReportSection[] {
  const rashi = (i: number) => RASHI_NAMES[i] ?? String(i);
  const dosha =
    f.mangalDosha === true
      ? "Mangal dosha is present from the ascendant."
      : f.mangalDosha === "mild"
        ? "A mild Mangal influence shows from the Moon only."
        : "No Mangal dosha is indicated.";
  const seventh = f.planetsInSeventh.length
    ? `With ${f.planetsInSeventh.join(", ")} in the 7th house, relationships carry extra weight and need conscious handling.`
    : "The 7th house is unoccupied, so the 7th lord carries the main message.";
  const map: Record<string, string> = {
    timing:
      `Your marriage timing is read from your 7th house in ${rashi(f.seventhSign)} and your current ${f.currentDashaLord} dasha (to ${f.currentDashaEnd}). The 7th lord ${f.seventhLord} sits in house ${f.seventhLordHouse}, which colours when and how commitment unfolds. Periods that activate the 7th house or its lord, and the Venus/Jupiter sub-periods, are the strongest windows. Use these as direction, not fixed dates.`,
    partner:
      `The 7th house in ${rashi(f.seventhSign)}, ruled by ${f.seventhLord} placed in house ${f.seventhLordHouse}, points to the temperament of a suitable partner and where you are likely to meet them. ${seventh} Look for someone who matches this flavour rather than a checklist.`,
    venusJupiter: `Venus, the karaka of love, is in ${rashi(f.venusSign)} in house ${f.venusHouse}, which shapes how you give and receive affection. Jupiter in ${rashi(f.jupiterSign)} in house ${f.jupiterHouse} shows your deeper values and expectations in marriage. Read these together: they show what you truly need, beyond attraction.`,
    doshas: `${dosha} A single factor never decides a marriage. Temperament, mutual consent, family context and shared expectations carry equal weight.`,
    marriedLife: `Married life is read from the 7th house and its lord. ${seventh} Calm, direct communication — saying the difficult thing early rather than storing it — keeps this placement constructive.`,
    finance: `Money and home after marriage are read from the 2nd, 4th and 11th houses supported by Jupiter's placement. Jupiter in house ${f.jupiterHouse} suggests where steady, durable gains are likely, provided speculative leaps are avoided.`,
    remedies: `Practical supports for this chart: keep a steady daily routine; respect elders and family obligations; donate to causes linked to Jupiter on Thursdays; avoid impulsive financial risks, especially in Rahu periods; and make major relationship decisions after a cooling-off period, not in the heat of the moment.`,
    conclusion: `Overall, this chart supports marriage; the work is in timing and communication rather than in any single hard placement. ${dosha} Let the reading guide your attention, and always decide with the person in front of you.`,
  };
  return FULL_REPORT_SECTIONS.map((id) => ({ id, body: map[id] }));
}

/**
 * Generate the full report. Always returns all eight sections: on any LLM
 * failure it falls back to the deterministic assembly above, so a verified
 * payment is never met with an empty page.
 */
export async function generateFullReport(
  kundli: KundliResult,
  locale: string
): Promise<ReportSection[]> {
  const facts = buildFacts(kundli);
  try {
    const { text } = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(facts, locale) },
      ],
      maxTokens: 4000,
      // Reasoning tokens count against max_tokens on deepseek-v4-flash: with
      // "low" the model burned the whole budget on reasoning and returned
      // truncated JSON (finish_reason=length), so every report silently fell
      // back. This is structured JSON assembly, not deep reasoning — "none"
      // returns clean, complete sections (and ~3x faster).
      reasoningEffort: "none",
    });
    const parsed = parseSections(text);
    if (parsed) {
      // Normalize to the canonical order and ensure every id is present.
      const byId = new Map(parsed.map((s) => [s.id, s.body]));
      const complete = FULL_REPORT_SECTIONS.map((id) => ({
        id,
        body: byId.get(id) ?? "",
      })).filter((s) => s.body);
      if (complete.length === FULL_REPORT_SECTIONS.length) return complete;
    }
  } catch (err) {
    console.warn("[report] LLM generation failed:", (err as Error).message);
  }
  return fallbackSections(facts);
}

/**
 * Keep only well-formed sections with known ids, in canonical order. Anything
 * the model (or a client) invents is dropped; a partial set is treated as no
 * set so the caller regenerates rather than serving a half report.
 */
function normalizeSections(raw: unknown): ReportSection[] | null {
  if (!Array.isArray(raw)) return null;
  const byId = new Map<string, string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, body } = item as { id?: unknown; body?: unknown };
    if (typeof id !== "string" || typeof body !== "string") continue;
    if (!FULL_REPORT_SECTIONS.includes(id as FullReportSectionId)) continue;
    if (!body.trim()) continue;
    byId.set(id, body);
  }
  const sections = FULL_REPORT_SECTIONS.map((id) => ({
    id,
    body: byId.get(id) ?? "",
  })).filter((s) => s.body);
  return sections.length === FULL_REPORT_SECTIONS.length ? sections : null;
}

/** The stored narrative for this device+pack, or null. Best-effort read. */
export async function getStoredReport(
  deviceId: string,
  packId: string
): Promise<ReportSection[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !deviceId) return null;
  try {
    const { data, error } = await admin
      .from("reports")
      .select("sections")
      .eq("device_id", deviceId)
      .eq("pack_id", packId)
      .maybeSingle();
    if (error) {
      console.warn("[report] stored report read failed:", error.message);
      return null;
    }
    return normalizeSections(data?.sections);
  } catch (err) {
    console.warn("[report] stored report read skipped:", (err as Error).message);
    return null;
  }
}

/**
 * Persist the report (written on download / chat handoff) so a re-visit is
 * re-served the same prose and the chat can answer follow-ups from it. Never
 * blocks the funnel: a failure just means the next view regenerates.
 */
export async function saveReport(params: {
  deviceId: string;
  packId: string;
  locale: string;
  facts: ReportFacts;
  sections: ReportSection[];
}): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin || !params.deviceId) return false;
  const sections = normalizeSections(params.sections);
  if (!sections) return false;
  try {
    const { error } = await admin.from("reports").upsert(
      {
        device_id: params.deviceId,
        pack_id: params.packId,
        locale: params.locale,
        facts: params.facts,
        sections,
        downloaded_at: new Date().toISOString(),
      },
      { onConflict: "device_id,pack_id" }
    );
    if (error) {
      console.warn("[report] save failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[report] save skipped:", (err as Error).message);
    return false;
  }
}
