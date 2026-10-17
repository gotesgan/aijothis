/**
 * Marriage report — the ₹199 one-off product.
 *
 * Split deliberately in two:
 *
 *  - `buildFacts` is PURE and deterministic. It reads the computed chart and
 *    returns raw placements (signs, houses, dasha) as NUMBERS/IDS, never prose.
 *    The client renders the free teaser from these using localized labels
 *    (@/lib/local-names) and i18n templates, so the teaser is instant, costs
 *    nothing, and speaks all three languages without a sign-by-sign table in
 *    each one.
 *  - the LLM-written narrative lives in @/lib/report-server (server-only, and
 *    only after a verified purchase).
 *
 * The free teaser is intentionally FACT-FORWARD. The strongest complaint in
 * paid-report reviews ("generic, computer-generated, could be anyone") is
 * answered by showing the person their OWN placements immediately, and by
 * selling a full report the model is told to ground in those same placements.
 */
import type { Currency } from "@/lib/money";
import type { KundliResult } from "@/lib/types";

/** Lord of each rashi, by index (Aries…Pisces). Standard Vedic rulership. */
export const SIGN_LORD = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
] as const;

/** Houses (from the ascendant) that trigger Mangal dosha. */
export const MANGAL_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12] as const;

/**
 * Report price per currency. Server-owned — the browser never sends an amount.
 * ₹199 sits deliberately below the Indian report market (₹299–₹1,499) and ends
 * in 9 to match the existing pack ladder; see the pricing analysis.
 */
export const REPORT_PRICE: Record<Currency, number> = {
  INR: 199,
  USD: 4.99,
  EUR: 4.99,
};

export const REPORT_PACK_PREFIX = "report-marriage";

/** Currency-scoped pack id, mirroring the packs in @/lib/pricing. */
export function reportPackId(currency: Currency): string {
  return `${REPORT_PACK_PREFIX}-${currency.toLowerCase()}`;
}

export function isReportPackId(packId: string | null | undefined): boolean {
  return typeof packId === "string" && packId.startsWith(REPORT_PACK_PREFIX);
}

/**
 * A section of the full report. Only `id` and `body` are shipped; the HEADING
 * is rendered client-side from i18n (`Report.sections.<id>`), so titles are
 * always correct in every language instead of drifting with the model's output.
 */
export interface ReportSection {
  id: string;
  body: string;
}

/**
 * Raw marriage-relevant placements. Deliberately no prose: every consumer
 * localizes it. All the fields the report and teaser depend on.
 */
export interface ReportFacts {
  lagna: number;
  moonRashi: number;
  moonNakshatra: number;
  moonNakshatraPad: number;
  sunRashi: number;
  /** Rashi occupying the 7th house (marriage). */
  seventhSign: number;
  /** Planet that rules that rashi. */
  seventhLord: string;
  /** House (from lagna) the 7th lord actually sits in. */
  seventhLordHouse: number;
  /** Planets sitting IN the 7th house. */
  planetsInSeventh: string[];
  venusSign: number;
  venusHouse: number;
  jupiterSign: number;
  jupiterHouse: number;
  marsHouse: number;
  /** true = dosha from lagna; "mild" = only from the Moon. */
  mangalDosha: boolean | "mild";
  currentDashaLord: string;
  currentDashaEnd: string;
  profile: KundliResult["profile"];
  planets: {
    id: string;
    symbol: string;
    rashi: number;
    degree: number;
    house: number;
    retrograde: boolean;
  }[];
  dasha: { lord: string; start: string; end: string; current: boolean }[];
}

/**
 * A paid marriage report as the client holds it: the placements, the generated
 * narrative, and which pack produced it. Persisted only when the buyer
 * downloads (or hands it to Arya) — see /api/report stage "download".
 */
export interface ReportCtx {
  packId: string;
  generatedAt: string;
  facts: ReportFacts;
  sections: ReportSection[];
}

/**
 * Compact, bounded text handed to the chat so Arya's follow-ups stay consistent
 * with the report the user already paid for. Language-neutral placements plus
 * the section prose, capped so it can never blow the prompt budget.
 */
export function reportChatContext(ctx: ReportCtx): string {
  const f = ctx.facts;
  const dosha =
    f.mangalDosha === true
      ? "present"
      : f.mangalDosha === "mild"
        ? "mild (from the Moon only)"
        : "not indicated";
  const head = [
    `Lagna rashi #${f.lagna}, Moon rashi #${f.moonRashi}, nakshatra #${f.moonNakshatra} pada ${f.moonNakshatraPad}`,
    `7th house rashi #${f.seventhSign}, 7th lord ${f.seventhLord} in house ${f.seventhLordHouse}`,
    `Venus house ${f.venusHouse}, Jupiter house ${f.jupiterHouse}, Mars house ${f.marsHouse}, Mangal dosha: ${dosha}`,
    `Current dasha ${f.currentDashaLord} until ${f.currentDashaEnd}`,
  ].join("; ");
  const body = ctx.sections.map((s) => `[${s.id}] ${s.body}`).join("\n");
  return `${head}\n\n${body}`.slice(0, 4000);
}

/** House of `planetRashi` counted from `fromRashi` (whole-sign, 1–12). */
function houseFrom(planetRashi: number, fromRashi: number): number {
  return ((planetRashi - fromRashi + 12) % 12) + 1;
}

export function buildFacts(kundli: KundliResult): ReportFacts {
  const { computed, planets, dasha, profile } = kundli;
  const lagna = computed.lagnaRashi;

  const seventhSign = (lagna + 6) % 12;
  const seventhLord = SIGN_LORD[seventhSign];

  const byId = (id: string) => planets.find((p) => p.id === id);
  const lord = byId(seventhLord);
  const venus = byId("venus");
  const jupiter = byId("jupiter");
  const mars = byId("mars");

  const planetsInSeventh = planets
    .filter((p) => p.house === 7)
    .map((p) => p.id);

  const marsHouse = mars?.house ?? 0;
  const marsFromMoon = mars ? houseFrom(mars.rashi, computed.moonRashi) : 0;
  const inDoshaHouses = (h: number) =>
    (MANGAL_DOSHA_HOUSES as readonly number[]).includes(h);
  const mangalDosha: ReportFacts["mangalDosha"] = inDoshaHouses(marsHouse)
    ? true
    : inDoshaHouses(marsFromMoon)
      ? "mild"
      : false;

  const current = dasha.periods[dasha.currentIndex];

  return {
    lagna,
    moonRashi: computed.moonRashi,
    moonNakshatra: computed.moonNakshatra,
    moonNakshatraPad: computed.moonNakshatraPad,
    sunRashi: computed.sunRashi,
    seventhSign,
    seventhLord,
    seventhLordHouse: lord?.house ?? 0,
    planetsInSeventh,
    venusSign: venus?.rashi ?? 0,
    venusHouse: venus?.house ?? 0,
    jupiterSign: jupiter?.rashi ?? 0,
    jupiterHouse: jupiter?.house ?? 0,
    marsHouse,
    mangalDosha,
    currentDashaLord: current?.lord ?? "",
    currentDashaEnd: current?.end ?? "",
    profile,
    planets: planets.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      rashi: p.rashi,
      degree: p.degree,
      house: p.house,
      retrograde: p.retrograde,
    })),
    dasha: dasha.periods.map((p) => ({
      lord: p.lord,
      start: p.start,
      end: p.end,
      current: p.current,
    })),
  };
}

/** Section ids of the full report, in order — also the teaser's lock list. */
export const FULL_REPORT_SECTIONS = [
  "timing",
  "partner",
  "venusJupiter",
  "doshas",
  "marriedLife",
  "finance",
  "remedies",
  "conclusion",
] as const;

export type FullReportSectionId = (typeof FULL_REPORT_SECTIONS)[number];
