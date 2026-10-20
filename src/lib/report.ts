/**
 * One-off paid reports — marriage, career & money, and baby/child.
 *
 * Split deliberately in two:
 *
 *  - this module is PURE and deterministic (no `node`, no LLM). `buildFacts`
 *    reads the computed chart and returns raw placements (signs, houses, dasha)
 *    as NUMBERS/IDS, never prose. The client renders the free teaser from these
 *    using localized labels (@/lib/local-names) and i18n templates, so the
 *    teaser is instant, costs nothing, and speaks all three languages without a
 *    sign-by-sign table in each one.
 *  - the LLM-written narrative lives in @/lib/report-server (server-only, and
 *    only after a verified purchase).
 *
 * All three reports share ONE engine: the same purchase check, pack-id scheme,
 * `reports` table, checkout, print-to-PDF shell and chat hand-off. Only the
 * facts read, the section ids, the prompt and the teaser differ — see
 * REPORT_SECTIONS and the per-type branches below.
 *
 * The free teaser is intentionally FACT-FORWARD. The strongest complaint in
 * paid-report reviews ("generic, computer-generated, could be anyone") is
 * answered by showing the person their OWN placements immediately, and by
 * selling a full report the model is told to ground in those same placements.
 */
import type { Currency } from "@/lib/money";
import { ageInYears } from "@/lib/age";
import type { KundliResult } from "@/lib/types";

/** The three one-off report products. */
export type ReportType = "marriage" | "career" | "child";

/** Narrow an arbitrary value (e.g. a request body field) to a ReportType. */
export function isReportType(v: unknown): v is ReportType {
  return v === "marriage" || v === "career" || v === "child";
}

/** Lord of each rashi, by index (Aries…Pisces). Standard Vedic rulership. */
export const SIGN_LORD = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
] as const;

/** Houses (from the ascendant) that trigger Mangal dosha. */
export const MANGAL_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12] as const;

/**
 * Report price per type and currency. Server-owned — the browser never sends an
 * amount, only a type. ₹199 sits deliberately below the Indian report market
 * (₹299–₹1,499) and ends in 9 to match the pack ladder; the baby/child report
 * carries a small naming premium (₹249) because it's bought at a once-in-a-
 * lifetime, emotionally high-intent moment (the naming ceremony).
 */
export const REPORT_PRICES: Record<ReportType, Record<Currency, number>> = {
  marriage: { INR: 199, USD: 4.99, EUR: 4.99 },
  career: { INR: 199, USD: 4.99, EUR: 4.99 },
  child: { INR: 249, USD: 5.99, EUR: 5.99 },
};

/** Marriage price map, kept as an alias for existing callers. */
export const REPORT_PRICE: Record<Currency, number> = REPORT_PRICES.marriage;

/** Currency-scoped product id per report type. */
export const REPORT_PACK_PREFIX: Record<ReportType, string> = {
  marriage: "report-marriage",
  career: "report-career",
  child: "report-child",
};

/**
 * The i18n namespace holding a report type's own copy (document title, section
 * names, disclaimer). It lives beside the section list rather than in the flow
 * component so the report page and the print page cannot disagree about where a
 * career section's label comes from — reading a career report out of the
 * marriage namespace resolves to nothing and mislabels the document.
 */
export function reportNamespace(type: ReportType): string {
  return type === "career" ? "CareerReport" : type === "child" ? "BabyReport" : "Report";
}

/** Currency-scoped pack id, mirroring the packs in @/lib/pricing. */
export function reportPackId(type: ReportType, currency: Currency): string {
  return `${REPORT_PACK_PREFIX[type]}-${currency.toLowerCase()}`;
}

/** Does this pack id belong to a report (optionally of a given type)? */
export function isReportPackId(
  packId: string | null | undefined,
  type?: ReportType
): boolean {
  if (typeof packId !== "string") return false;
  if (type) return packId.startsWith(REPORT_PACK_PREFIX[type]);
  return Object.values(REPORT_PACK_PREFIX).some((p) => packId.startsWith(p));
}

/** Which report a pack id belongs to, or null. */
export function reportTypeFromPackId(
  packId: string | null | undefined
): ReportType | null {
  if (typeof packId !== "string") return null;
  const hit = (Object.keys(REPORT_PACK_PREFIX) as ReportType[]).find((t) =>
    packId.startsWith(REPORT_PACK_PREFIX[t])
  );
  return hit ?? null;
}

/**
 * Naming syllables (namakshar) for the 27 nakshatras — 4 padas each, in order.
 * The traditional North-Indian scheme, used to pick the first letter of a
 * newborn's name from the Moon's nakshatra and pada. Given in both Roman
 * transliteration (shown in English) and Devanagari (shown in hi/mr).
 * These are convention, not computation — keep the pada order intact.
 */
export const NAKSHATRA_SYLLABLES: { rom: string; dev: string }[][] = [
  [{ rom: "Chu", dev: "चु" }, { rom: "Che", dev: "चे" }, { rom: "Cho", dev: "चो" }, { rom: "La", dev: "ला" }],
  [{ rom: "Li", dev: "ली" }, { rom: "Lu", dev: "लू" }, { rom: "Le", dev: "ले" }, { rom: "Lo", dev: "लो" }],
  [{ rom: "A", dev: "अ" }, { rom: "I", dev: "ई" }, { rom: "U", dev: "उ" }, { rom: "E", dev: "ए" }],
  [{ rom: "O", dev: "ओ" }, { rom: "Va", dev: "वा" }, { rom: "Vi", dev: "वी" }, { rom: "Vu", dev: "वू" }],
  [{ rom: "Ve", dev: "वे" }, { rom: "Vo", dev: "वो" }, { rom: "Ka", dev: "का" }, { rom: "Ki", dev: "की" }],
  [{ rom: "Ku", dev: "कू" }, { rom: "Gha", dev: "घ" }, { rom: "Nga", dev: "ङ" }, { rom: "Chha", dev: "छ" }],
  [{ rom: "Ke", dev: "के" }, { rom: "Ko", dev: "को" }, { rom: "Ha", dev: "हा" }, { rom: "Hi", dev: "ही" }],
  [{ rom: "Hu", dev: "हू" }, { rom: "He", dev: "हे" }, { rom: "Ho", dev: "हो" }, { rom: "Da", dev: "डा" }],
  [{ rom: "Di", dev: "डी" }, { rom: "Du", dev: "डू" }, { rom: "De", dev: "डे" }, { rom: "Do", dev: "डो" }],
  [{ rom: "Ma", dev: "मा" }, { rom: "Mi", dev: "मी" }, { rom: "Mu", dev: "मू" }, { rom: "Me", dev: "मे" }],
  [{ rom: "Mo", dev: "मो" }, { rom: "Ta", dev: "टा" }, { rom: "Ti", dev: "टी" }, { rom: "Tu", dev: "टू" }],
  [{ rom: "Te", dev: "टे" }, { rom: "To", dev: "टो" }, { rom: "Pa", dev: "पा" }, { rom: "Pi", dev: "पी" }],
  [{ rom: "Pu", dev: "पू" }, { rom: "Sha", dev: "ष" }, { rom: "Na", dev: "ण" }, { rom: "Tha", dev: "ठ" }],
  [{ rom: "Pe", dev: "पे" }, { rom: "Po", dev: "पो" }, { rom: "Ra", dev: "रा" }, { rom: "Ri", dev: "री" }],
  [{ rom: "Ru", dev: "रू" }, { rom: "Re", dev: "रे" }, { rom: "Ro", dev: "रो" }, { rom: "Ta", dev: "ता" }],
  [{ rom: "Ti", dev: "ती" }, { rom: "Tu", dev: "तू" }, { rom: "Te", dev: "ते" }, { rom: "To", dev: "तो" }],
  [{ rom: "Na", dev: "ना" }, { rom: "Ni", dev: "नी" }, { rom: "Nu", dev: "नू" }, { rom: "Ne", dev: "ने" }],
  [{ rom: "No", dev: "नो" }, { rom: "Ya", dev: "या" }, { rom: "Yi", dev: "यी" }, { rom: "Yu", dev: "यू" }],
  [{ rom: "Ye", dev: "ये" }, { rom: "Yo", dev: "यो" }, { rom: "Bha", dev: "भा" }, { rom: "Bhi", dev: "भी" }],
  [{ rom: "Bhu", dev: "भू" }, { rom: "Dha", dev: "धा" }, { rom: "Pha", dev: "फा" }, { rom: "Dha", dev: "ढा" }],
  [{ rom: "Bhe", dev: "भे" }, { rom: "Bho", dev: "भो" }, { rom: "Ja", dev: "जा" }, { rom: "Ji", dev: "जी" }],
  [{ rom: "Khi", dev: "खी" }, { rom: "Khu", dev: "खू" }, { rom: "Khe", dev: "खे" }, { rom: "Kho", dev: "खो" }],
  [{ rom: "Ga", dev: "गा" }, { rom: "Gi", dev: "गी" }, { rom: "Gu", dev: "गू" }, { rom: "Ge", dev: "गे" }],
  [{ rom: "Go", dev: "गो" }, { rom: "Sa", dev: "सा" }, { rom: "Si", dev: "सी" }, { rom: "Su", dev: "सू" }],
  [{ rom: "Se", dev: "से" }, { rom: "So", dev: "सो" }, { rom: "Da", dev: "दा" }, { rom: "Di", dev: "दी" }],
  [{ rom: "Du", dev: "दू" }, { rom: "Tha", dev: "थ" }, { rom: "Jha", dev: "झ" }, { rom: "Na", dev: "ञ" }],
  [{ rom: "De", dev: "दे" }, { rom: "Do", dev: "दो" }, { rom: "Cha", dev: "चा" }, { rom: "Chi", dev: "ची" }],
];

/**
 * A section of the full report. Only `id` and `body` are shipped; the HEADING
 * is rendered client-side from i18n (`<ns>.sections.<id>`), so titles are
 * always correct in every language instead of drifting with the model's output.
 */
export interface ReportSection {
  id: string;
  body: string;
}

/**
 * Raw report-relevant placements. Deliberately no prose: every consumer
 * localizes it. A superset shared by all three reports — each report reads the
 * subset its sections care about.
 */
export interface ReportFacts {
  // ── Shared / identity ────────────────────────────────────────────────
  /**
   * Whole years at the time this chart was built. Derived from the birth date,
   * never stored: a read-through of a saved report must not silently age, and a
   * fresh build should always be current.
   */
  age: number;
  lagna: number;
  moonRashi: number;
  moonNakshatra: number;
  moonNakshatraPad: number;
  sunRashi: number;
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

  // ── Marriage ─────────────────────────────────────────────────────────
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

  // ── Career & money ───────────────────────────────────────────────────
  tenthSign: number;
  tenthLord: string;
  tenthLordHouse: number;
  planetsInTenth: string[];
  /** House of the 10th lord as a rashi (for navamsa-free briefs). */
  secondSign: number;
  secondLord: string;
  secondLordHouse: number;
  eleventhSign: number;
  eleventhLord: string;
  eleventhLordHouse: number;
  sixthSign: number;
  sixthLord: string;
  sixthLordHouse: number;
  sunHouse: number;
  saturnHouse: number;
  mercuryHouse: number;
  rahuHouse: number;

  // ── Baby / child ─────────────────────────────────────────────────────
  fifthSign: number;
  fifthLord: string;
  fifthLordHouse: number;
  fourthSign: number;
  fourthLord: string;
  fourthLordHouse: number;
  ninthSign: number;
  ninthLord: string;
  ninthLordHouse: number;
  /** The 4 naming syllables for the Moon nakshatra (Roman + Devanagari). */
  namingSyllables: { rom: string; dev: string }[];
  /** The syllable for the Moon's exact pada (1–4). */
  namingLetter: { rom: string; dev: string };
}

/**
 * A paid report as the client holds it: the placements, the generated
 * narrative, and which pack produced it. Persisted only when the buyer
 * downloads (or hands it to Arya) — see /api/report stage "download".
 */
export interface ReportCtx {
  type: ReportType;
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
  const type = ctx.type ?? "marriage";
  const head =
    type === "career"
      ? [
          `Career & money report. Lagna rashi #${f.lagna}, Moon rashi #${f.moonRashi}, nakshatra #${f.moonNakshatra}`,
          `10th house (career) rashi #${f.tenthSign}, 10th lord ${f.tenthLord} in house ${f.tenthLordHouse}`,
          `Wealth: 2nd lord ${f.secondLord} in house ${f.secondLordHouse}; gains: 11th lord ${f.eleventhLord} in house ${f.eleventhLordHouse}; service: 6th lord ${f.sixthLord} in house ${f.sixthLordHouse}`,
          `Sun house ${f.sunHouse}, Saturn house ${f.saturnHouse}, Mercury house ${f.mercuryHouse}, Jupiter house ${f.jupiterHouse}, Mars house ${f.marsHouse}, Rahu house ${f.rahuHouse}`,
          `Current dasha ${f.currentDashaLord} until ${f.currentDashaEnd}`,
        ].join("; ")
      : type === "child"
        ? [
            `Baby/child report. Lagna rashi #${f.lagna}, Moon rashi #${f.moonRashi}, nakshatra #${f.moonNakshatra} pada ${f.moonNakshatraPad}`,
            `Naming syllables: ${f.namingSyllables.map((s) => s.rom).join(", ")}; pada letter ${f.namingLetter.rom}`,
            `5th house (intelligence) rashi #${f.fifthSign}, 5th lord ${f.fifthLord} in house ${f.fifthLordHouse}`,
            `4th lord ${f.fourthLord} in house ${f.fourthLordHouse}, 9th lord ${f.ninthLord} in house ${f.ninthLordHouse}`,
            `Jupiter (putrakaraka) house ${f.jupiterHouse}, Mercury (speech) house ${f.mercuryHouse}, Saturn house ${f.saturnHouse}`,
            `Current dasha ${f.currentDashaLord} until ${f.currentDashaEnd}`,
          ].join("; ")
        : [
            `Marriage report. Lagna rashi #${f.lagna}, Moon rashi #${f.moonRashi}, nakshatra #${f.moonNakshatra} pada ${f.moonNakshatraPad}`,
            `7th house rashi #${f.seventhSign}, 7th lord ${f.seventhLord} in house ${f.seventhLordHouse}`,
            `Venus house ${f.venusHouse}, Jupiter house ${f.jupiterHouse}, Mars house ${f.marsHouse}, Mangal dosha: ${f.mangalDosha === true ? "present" : f.mangalDosha === "mild" ? "mild (from the Moon only)" : "not indicated"}`,
            `Current dasha ${f.currentDashaLord} until ${f.currentDashaEnd}`,
          ].join("; ");
  const body = ctx.sections.map((s) => `[${s.id}] ${s.body}`).join("\n");
  return `${head}\n\n${body}`.slice(0, 4000);
}

/** House of `planetRashi` counted from `fromRashi` (whole-sign, 1–12). */
function houseFrom(planetRashi: number, fromRashi: number): number {
  return ((planetRashi - fromRashi + 12) % 12) + 1;
}

/** Rashi occupying the nth house from the ascendant (whole-sign). */
function houseSign(lagna: number, house: number): number {
  return (lagna + house - 1) % 12;
}

export function buildFacts(kundli: KundliResult): ReportFacts {
  const { computed, planets, dasha, profile } = kundli;
  const lagna = computed.lagnaRashi;

  const byId = (id: string) => planets.find((p) => p.id === id);
  /** Sign, lord and the lord's house for a given house number. */
  const house = (n: number) => {
    const sign = houseSign(lagna, n);
    const lordId = SIGN_LORD[sign];
    return { sign, lord: lordId as string, lordHouse: byId(lordId)?.house ?? 0 };
  };
  const planetsIn = (n: number) =>
    planets.filter((p) => p.house === n).map((p) => p.id);

  const seventhSign = houseSign(lagna, 7);
  const seventhLord = SIGN_LORD[seventhSign];
  const seventh = house(7);
  const venus = byId("venus");
  const jupiter = byId("jupiter");
  const mars = byId("mars");

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

  const second = house(2);
  const fourth = house(4);
  const fifth = house(5);
  const sixth = house(6);
  const ninth = house(9);
  const tenth = house(10);
  const eleventh = house(11);

  const pada = Math.min(Math.max(computed.moonNakshatraPad || 1, 1), 4) - 1;
  const syllables = NAKSHATRA_SYLLABLES[computed.moonNakshatra] ?? NAKSHATRA_SYLLABLES[0];

  return {
    age: ageInYears(profile.date),
    lagna,
    moonRashi: computed.moonRashi,
    moonNakshatra: computed.moonNakshatra,
    moonNakshatraPad: computed.moonNakshatraPad,
    sunRashi: computed.sunRashi,
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

    // Marriage
    seventhSign,
    seventhLord,
    seventhLordHouse: seventh.lordHouse,
    planetsInSeventh: planetsIn(7),
    venusSign: venus?.rashi ?? 0,
    venusHouse: venus?.house ?? 0,
    jupiterSign: jupiter?.rashi ?? 0,
    jupiterHouse: jupiter?.house ?? 0,
    marsHouse,
    mangalDosha,

    // Career & money
    tenthSign: tenth.sign,
    tenthLord: tenth.lord,
    tenthLordHouse: tenth.lordHouse,
    planetsInTenth: planetsIn(10),
    secondSign: second.sign,
    secondLord: second.lord,
    secondLordHouse: second.lordHouse,
    eleventhSign: eleventh.sign,
    eleventhLord: eleventh.lord,
    eleventhLordHouse: eleventh.lordHouse,
    sixthSign: sixth.sign,
    sixthLord: sixth.lord,
    sixthLordHouse: sixth.lordHouse,
    sunHouse: byId("sun")?.house ?? 0,
    saturnHouse: byId("saturn")?.house ?? 0,
    mercuryHouse: byId("mercury")?.house ?? 0,
    rahuHouse: byId("rahu")?.house ?? 0,

    // Baby / child
    fifthSign: fifth.sign,
    fifthLord: fifth.lord,
    fifthLordHouse: fifth.lordHouse,
    fourthSign: fourth.sign,
    fourthLord: fourth.lord,
    fourthLordHouse: fourth.lordHouse,
    ninthSign: ninth.sign,
    ninthLord: ninth.lord,
    ninthLordHouse: ninth.lordHouse,
    namingSyllables: syllables,
    namingLetter: syllables[pada] ?? syllables[0],
  };
}

/**
 * Section ids of each full report, in order — also each teaser's lock list.
 * The HEADINGS come from i18n; only these ids cross the wire.
 */
export const REPORT_SECTIONS: Record<ReportType, readonly string[]> = {
  marriage: [
    "timing",
    "partner",
    "venusJupiter",
    "doshas",
    "marriedLife",
    "finance",
    "remedies",
    "conclusion",
  ],
  career: [
    "direction",
    "jobOrBusiness",
    "income",
    "timing",
    "growth",
    "risks",
    "remedies",
    "conclusion",
  ],
  child: [
    "naming",
    "temperament",
    "strengths",
    "learning",
    "care",
    "milestones",
    "remedies",
    "conclusion",
  ],
};

/** Marriage section ids, kept as an alias for existing callers. */
export const FULL_REPORT_SECTIONS = REPORT_SECTIONS.marriage;

export type FullReportSectionId = (typeof FULL_REPORT_SECTIONS)[number];
export type ReportSectionId =
  | FullReportSectionId
  | (typeof REPORT_SECTIONS.career)[number]
  | (typeof REPORT_SECTIONS.child)[number];
