/**
 * Server-only half of the paid reports: purchase checks and the LLM-written
 * narrative. Kept apart from @/lib/report so the pure facts module stays free
 * of `node`/LLM imports and can be shared with the client bundle.
 *
 * All three reports run through ONE harness (`generateFullReport`) that differs
 * only by the report type: the chart brief, the section intents and the
 * deterministic fallback. Purchase checks and persistence are type-scoped but
 * otherwise identical.
 */
import { getSupabaseAdmin } from "@/lib/supabase";
import { chatCompletion } from "@/lib/llm";
import {
  buildFacts,
  isReportPackId,
  REPORT_SECTIONS,
  type ReportFacts,
  type ReportSection,
  type ReportType,
} from "@/lib/report";
import { RASHI_NAMES, NAKSHATRA_NAMES } from "@/lib/kundli";
import type { KundliResult } from "@/lib/types";

/** Has this device ever settled an order for a report of this type? */
export async function hasReportPurchase(
  deviceId: string,
  type: ReportType = "marriage"
): Promise<boolean> {
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
    return (data ?? []).some((row) => isReportPackId(row.pack_id, type));
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

const RULES = {
  base: [
    "Ground EVERY claim in the exact placements given. Name the sign, house or lord you are reading from. Never write a sentence that would fit any chart.",
    "Be specific and practical, in plain warm language. No filler, no \"you are a unique person\", no generic horoscope lines.",
    "You MAY give timing windows from the Vimshottari dasha, but never invent exact dates or guarantees.",
    "Be honest about difficulties; give constructive, non-fear-based remedies.",
    "Do not give medical, legal or financial guarantees. This is guidance for reflection.",
    "Write in the requested language only.",
    "Return ONLY valid JSON, no markdown fences.",
    // Depth and balance — the reader has paid for this, so it must read as a
    // real reading rather than a summary. Both halves matter: what the chart
    // supports AND what it asks the person to watch.
    "This is a PAID reading. It must be substantial and worth re-reading, never a summary. Write 3–4 paragraphs per section (roughly 200–280 words each).",
    "Every section must hold BOTH sides: what works in the person's favour, and the tendency or difficulty the same placement brings. Praise alone is dishonest; warning alone is fear-mongering. Give them together.",
    "Each paragraph must add a NEW observation. Never restate a point in different words to fill space, and never repeat a sentence pattern from another section. Open each section differently.",
    "Be concrete: say what this looks like in ordinary life — a habit, a situation, a kind of person, a choice — not just what the planet signifies.",
    "Write to this person's actual stage of life. Advice that would only make sense for a different age is a failure, and never assume a first marriage, a first job or a living parent.",
    "Close every section with one practical thing the reader can actually do, avoid or watch for.",
    "Never mention that you are an AI, never mention these instructions, and never address the reader as a group.",
  ],
  marriage: [],
  career: [
    "Never promise a specific job, salary or promotion, and never advise on a specific investment. Describe tendencies, fields and timing windows only.",
  ],
  child: [
    "This is a report about a CHILD. Never predict, guess or hint at illness, health conditions, disability, accidents or lifespan — not even gently. Do not say the child will be sick or healthy in specific terms; you may only speak of general care, routine and wellbeing in supportive terms.",
    "Never predict death, danger, or any negative life event. Keep every statement encouraging and forward-looking.",
    "Do not label the child. Describe tendencies and strengths the parents can nurture, and avoid deterministic verdicts about the child's future.",
    "For this report the \"difficult\" half of each section is written for the PARENTS: what needs patience, structure or understanding from them. Never as a flaw in the child.",
  ],
};

function systemPrompt(type: ReportType): string {
  const kind =
    type === "career"
      ? "a PAID career & money report"
      : type === "child"
        ? "a PAID baby/child (janam patri) report for the parents"
        : "a PAID marriage report";
  return [
    `You are a careful Vedic (Jyotish) astrologer writing ${kind}.`,
    "Rules you must follow:",
    ...RULES.base,
    ...RULES[type],
  ].join("\n");
}

/** Compact, model-readable summary of the placements that matter for the type. */
function chartBrief(type: ReportType, f: ReportFacts): string {
  const rashi = (i: number) => RASHI_NAMES[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA_NAMES[i] ?? String(i);
  const base = [
    `Lagna (ascendant): ${rashi(f.lagna)}`,
    `Moon sign: ${rashi(f.moonRashi)}; Nakshatra: ${nak(f.moonNakshatra)}, pada ${f.moonNakshatraPad}`,
    `Sun sign: ${rashi(f.sunRashi)}`,
    `Gender of the chart owner: ${f.profile.gender ?? "not given"}`,
  ];

  if (type === "career") {
    return [
      ...base,
      `10th house (career) sign: ${rashi(f.tenthSign)}; 10th lord: ${f.tenthLord} in house ${f.tenthLordHouse}`,
      `Planets in the 10th house: ${f.planetsInTenth.length ? f.planetsInTenth.join(", ") : "none"}`,
      `2nd house (wealth) sign: ${rashi(f.secondSign)}; 2nd lord: ${f.secondLord} in house ${f.secondLordHouse}`,
      `11th house (gains) sign: ${rashi(f.eleventhSign)}; 11th lord: ${f.eleventhLord} in house ${f.eleventhLordHouse}`,
      `6th house (service/job) sign: ${rashi(f.sixthSign)}; 6th lord: ${f.sixthLord} in house ${f.sixthLordHouse}`,
      `Sun (authority) house ${f.sunHouse}; Saturn (discipline/labour) house ${f.saturnHouse}`,
      `Mercury (business/trade/speech) house ${f.mercuryHouse}; Jupiter (expansion) house ${f.jupiterHouse}`,
      `Mars (drive/competition) house ${f.marsHouse}; Rahu (ambition/foreign/tech) house ${f.rahuHouse}`,
      `Current Vimshottari dasha: ${f.currentDashaLord} until ${f.currentDashaEnd}`,
    ].join("\n");
  }

  if (type === "child") {
    const syll = f.namingSyllables.map((s) => `${s.rom} (${s.dev})`).join(", ");
    return [
      `Lagna (ascendant): ${rashi(f.lagna)}`,
      `Moon sign: ${rashi(f.moonRashi)}`,
      `Moon nakshatra: ${nak(f.moonNakshatra)}, pada ${f.moonNakshatraPad}`,
      `Naming syllables for this nakshatra (pada 1–4): ${syll}`,
      `The syllable for this child's exact pada: ${f.namingLetter.rom} (${f.namingLetter.dev})`,
      `5th house (intelligence/education) sign: ${rashi(f.fifthSign)}; 5th lord: ${f.fifthLord} in house ${f.fifthLordHouse}`,
      `4th house (mother/home) sign: ${rashi(f.fourthSign)}; 4th lord: ${f.fourthLord} in house ${f.fourthLordHouse}`,
      `9th house (father/luck) sign: ${rashi(f.ninthSign)}; 9th lord: ${f.ninthLord} in house ${f.ninthLordHouse}`,
      `Jupiter (putrakaraka/wisdom) house ${f.jupiterHouse}; Mercury (speech/learning) house ${f.mercuryHouse}`,
      `Saturn (patience/lessons) house ${f.saturnHouse}; Venus (art/affection) house ${f.venusHouse}`,
      `Current Vimshottari dasha: ${f.currentDashaLord} until ${f.currentDashaEnd}`,
    ].join("\n");
  }

  // marriage
  const seven = f.planetsInSeventh.length ? f.planetsInSeventh.join(", ") : "none";
  return [
    ...base,
    `7th house (marriage) sign: ${rashi(f.seventhSign)}`,
    `7th lord: ${f.seventhLord} in house ${f.seventhLordHouse}`,
    `Planets in the 7th house: ${seven}`,
    `Venus (wife/partner karaka): ${rashi(f.venusSign)}, house ${f.venusHouse}`,
    `Jupiter (husband/values karaka): ${rashi(f.jupiterSign)}, house ${f.jupiterHouse}`,
    `Mars in house ${f.marsHouse} → Mangal dosha: ${f.mangalDosha === true ? "present" : f.mangalDosha === "mild" ? "mild (from Moon only)" : "not indicated"}`,
    `Current Vimshottari dasha: ${f.currentDashaLord} until ${f.currentDashaEnd}`,
  ].join("\n");
}

const INTENT: Record<ReportType, Record<string, string>> = {
  marriage: {
    timing: "strongest marriage windows implied by the current and next dasha, and what the 7th lord's house says about readiness.",
    partner: "the kind of partner indicated by the 7th house sign, its lord, and planets in the 7th.",
    venusJupiter: "what Venus and Jupiter placements say about affection, values and expectations in marriage.",
    doshas: "Mangal dosha verdict (state clearly if it is absent), and any other caution, without fear-mongering.",
    marriedLife: "how married life and communication are likely to feel, from the 7th house and its lord.",
    finance: "money, home and family life after marriage.",
    remedies: "4–6 concrete, simple, practical remedies (mantra, charity, routine, behaviour) tied to the placements.",
    conclusion: "a balanced closing verdict and one sentence of honest direction.",
  },
  career: {
    direction: "the fields and kinds of work this chart is naturally built for, from the 10th house sign, its lord and planets in the 10th.",
    jobOrBusiness: "whether salaried service or independent business suits better, reading the 6th (service) against the 10th/7th and Mercury/Mars.",
    income: "wealth potential and the likeliest income sources, from the 2nd (wealth), 11th (gains) and Jupiter's placement.",
    timing: "career windows implied by the current and next dasha and activation of the 10th house or its lord — direction, not fixed dates.",
    growth: "how promotion, expansion and recognition are likely to come, and what Jupiter and Saturn add.",
    risks: "where money and momentum tend to leak — speculation, debt, impulsive moves, Rahu/Mars/Saturn pressures — stated plainly but without fear.",
    remedies: "4–6 concrete, simple, practical remedies (mantra, charity, routine, behaviour) tied to the placements.",
    conclusion: "a balanced closing verdict on work and money, with one sentence of honest direction.",
  },
  child: {
    naming: "the traditional naming syllables from the Moon's nakshatra and pada — state the exact pada syllable clearly, then the family of letters.",
    temperament: "the child's likely nature and mind, from the Moon sign, nakshatra and lagna, in warm and encouraging terms.",
    strengths: "innate gifts and talents the parents can nurture, from the 5th house, Jupiter and Mercury.",
    learning: "how this child learns best, from the 5th house (intelligence), Mercury (speech/analysis) and the 4th house (early environment).",
    care: "supportive care, routine and environment — general wellbeing and nurturing only. Do NOT mention illness, health conditions or anything medical.",
    milestones: "gentle, encouraging timing notes from the dasha about phases of growth and development. No fixed dates, no negative events.",
    remedies: "4–6 gentle, positive practices for the parents (routine, blessings, charity, mantra) tied to the placements — nothing fear-based.",
    conclusion: "a warm, encouraging closing for the parents, with one supportive sentence.",
  },
};

function buildPrompt(type: ReportType, f: ReportFacts, locale: string): string {
  const lang = LANGUAGE[locale] ?? "English";
  const ids = REPORT_SECTIONS[type];
  const list = ids.join(", ");
  const subject =
    type === "career"
      ? "career & money report"
      : type === "child"
        ? "baby/child janam patri report for the parents"
        : "marriage report";
  return [
    `Write a ${subject} in ${lang}.`,
    "",
    "The person this reading is for:",
    personBrief(type, f),
    "",
    "Chart placements (sidereal, Lahiri, whole-sign houses):",
    chartBrief(type, f),
    "",
    `Return a JSON object: {"sections":[{"id":"<id>","body":"<text>"}]} with EXACTLY these ids in order: ${list}.`,
    "Each body must be 200–280 words of flowing prose (3–4 short paragraphs, separated by a blank line).",
    "Section intent:",
    ...ids.map((id) => `- ${id}: ${INTENT[type][id] ?? ""}`),
  ].join("\n");
}

/** Who the reading is for — name, gender and life stage, all optional-safe. */
function personBrief(type: ReportType, f: ReportFacts): string {
  const name = f.profile.name?.trim();
  const g = f.profile.gender;
  const lines: string[] = [];
  if (type === "child") {
    lines.push(
      `This is the chart of a child${name ? ` named ${name}` : ""}, aged ${f.age}.`
    );
    if (g === "female" || g === "male") {
      lines.push(
        `The child is a ${g === "female" ? "girl — write \"your daughter\" / \"she\"" : "boy — write \"your son\" / \"he\""} throughout.`
      );
    } else {
      lines.push(`The child's gender is not given — write "your child" / "they" throughout. Never guess it.`);
    }
    lines.push(`The reader is the parent, so address the parent as "you".`);
  } else {
    lines.push(
      `This is the chart of the reader${name ? `, named ${name}` : ""}, aged ${f.age} — address them as "you" throughout.`
    );
    if (g === "female" || g === "male") {
      lines.push(
        `The reader is ${g === "female" ? "a woman" : "a man"}. Read the partner karakas accordingly and use the matching gendered wording: ${g === "female" ? "Jupiter and the 7th house describe the husband, and she is the wife" : "Venus and the 7th house describe the wife, and he is the husband"}. Never refer to the partner with the wrong gender.`
      );
    } else {
      lines.push(
        `The reader's gender is not given. Write "partner" and "spouse" rather than husband or wife, and avoid he/she for the partner.`
      );
    }
  }
  const stage = lifeStage(type, f.age);
  if (stage) lines.push(stage);
  return lines.join("\n");
}

/**
 * How old the person is changes what the same placement means, so the prompt is
 * told the stage rather than left to assume a 20-something. The marriage lines
 * are deliberately careful for older readers: someone in their fifties may be
 * married, divorced or widowed, and a report that assumes a first marriage reads
 * as a machine that never looked at them.
 */
function lifeStage(type: ReportType, age: number): string {
  if (age <= 0) return "";

  if (type === "child") {
    if (age <= 1)
      return "The child is a baby: speak to the parent about the first year — attachment, routine, naming, tuning in to temperament. Nothing about development milestones as predictions.";
    if (age <= 4)
      return "The child is a toddler: the useful reading is temperament, play, language and the home atmosphere, written for the parent who is in it daily.";
    if (age <= 12)
      return "The child is school-age: read learning style, friendships, confidence and encouragement, and keep every line within what a parent can act on.";
    return "The child is an adolescent: read independence, self-direction and identity. Be tactful and never prescriptive — the parent is a witness to this stage, not its author.";
  }

  if (type === "career") {
    if (age < 25)
      return "They are early in their working life: read direction, aptitude and first choices — what kind of work suits, what to learn, which environments reward them. Do not write as though they are already mid-career.";
    if (age < 35)
      return "They are building: the useful reading is choosing and compounding — which direction to commit to, when a change pays off, and where income starts to accumulate.";
    if (age < 50)
      return "They are mid-career: read advancement, leverage, reputation and the traps of the years they are in — not first-job advice.";
    return "They are in their later working years: read seniority, authority, teaching and second acts, and be honest about the difference between a fresh start and a well-earned consolidation.";
  }

  // marriage
  if (age < 24)
    return "They are young: marriage is mostly ahead. Read the kind of partner and the readiness the chart implies, and frame timing as seasons rather than as a deadline.";
  if (age < 32)
    return "They are in the years when this is a live question: the timing windows matter, and so does the temperament of the partner indicated.";
  if (age < 45)
    return "Read partnership quality, compatibility and the work of a relationship, with timings given as nearer-term openings rather than as a countdown.";
  return "They may already be married, divorced, widowed or never married — never assume a first marriage, never ask why they are single, and never imply a deadline. Read the 7th house for partnership, companionship and communication as they are lived now.";
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
function fallbackSections(type: ReportType, f: ReportFacts): ReportSection[] {
  const rashi = (i: number) => RASHI_NAMES[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA_NAMES[i] ?? String(i);
  const ids = REPORT_SECTIONS[type];

  let map: Record<string, string>;

  if (type === "career") {
    map = {
      direction: `Your career is read from the 10th house in ${rashi(f.tenthSign)}, ruled by ${f.tenthLord} placed in house ${f.tenthLordHouse}. That lord's house colours the field you are drawn to and the way you are seen at work.${f.planetsInTenth.length ? ` With ${f.planetsInTenth.join(", ")} in the 10th, your public role carries extra weight and visibility.` : " The 10th house is unoccupied, so the 10th lord and the Sun carry the main message."} Lean into work that matches this flavour rather than chasing a title.`,
      jobOrBusiness: `Service is read from the 6th house in ${rashi(f.sixthSign)} and its lord ${f.sixthLord} in house ${f.sixthLordHouse}; independent work from the 10th and Mercury's placement (house ${f.mercuryHouse}). Where the 6th is steady and Mercury strong, salaried work rewards you; where the 10th lord is assertive and Mars (house ${f.marsHouse}) supports it, building your own venture suits better. Follow the placement that gives you energy, not the one that sounds safer.`,
      income: `Wealth is read from the 2nd house in ${rashi(f.secondSign)}, its lord ${f.secondLord} in house ${f.secondLordHouse}, and gains from the 11th lord ${f.eleventhLord} in house ${f.eleventhLordHouse}. Jupiter in house ${f.jupiterHouse} shows where durable, steady growth is most likely. Income tends to build through patience and compounding rather than through sudden speculative leaps.`,
      timing: `Your career timing comes from your current ${f.currentDashaLord} dasha (to ${f.currentDashaEnd}) and the activation of your 10th house or its lord. Periods that light up the 10th lord, the Sun or Saturn are the strongest windows for a change, a promotion or a new venture. Treat these as direction and seasons, not fixed dates.`,
      growth: `Growth and recognition are read from Jupiter (house ${f.jupiterHouse}) and Saturn (house ${f.saturnHouse}). Jupiter shows where expansion and mentors arrive; Saturn shows what must first be earned through steady, unglamorous work. Progress here rewards consistency and reputation far more than a single bold move.`,
      risks: `Watch where momentum leaks: speculate only with money you can afford to lose, avoid impulsive commitments in Rahu (house ${f.rahuHouse}) or Mars (house ${f.marsHouse}) periods, and keep debt proportional to income. These are not certainties — they are the places this chart asks you to slow down deliberately.`,
      remedies: `Practical supports for this chart: keep a disciplined daily routine; respect and serve elders and mentors; donate to causes linked to your 10th and 2nd lords on the appropriate days; avoid impulsive financial risks; and make major career or money decisions after a cooling-off period, never in the heat of the moment.`,
      conclusion: `Overall, this chart supports steady, earned success in work and money; the work is in choosing the right field, timing the moves, and avoiding impatience. Let the reading guide your attention, then decide with the facts in front of you.`,
    };
  } else if (type === "child") {
    map = {
      naming: `Your child's Moon is in ${nak(f.moonNakshatra)}, pada ${f.moonNakshatraPad}, so the traditional naming letters for this nakshatra are ${f.namingSyllables.map((s) => `${s.rom} (${s.dev})`).join(", ")}. For this exact pada the syllable is ${f.namingLetter.rom} (${f.namingLetter.dev}). Choose a name beginning with this sound to align the name with the Moon's nakshatra, as is customary.`,
      temperament: `Temperament is read from the Moon (${nak(f.moonNakshatra)}) and the lagna (${rashi(f.lagna)}). This child is likely to show the qualities of the Moon's sign ${rashi(f.moonRashi)} — warm, receptive and shaped by the home atmosphere. Nurture this nature gently rather than forcing it; the lagna colours how your child meets the world.`,
      strengths: `Natural gifts are read from the 5th house in ${rashi(f.fifthSign)}, its lord ${f.fifthLord} in house ${f.fifthLordHouse}, along with Jupiter (house ${f.jupiterHouse}) and Mercury (house ${f.mercuryHouse}). These placements show where learning, creativity and curiosity will come most easily — a good place for parents to encourage without pressure.`,
      learning: `How your child learns best comes from the 5th house (intelligence) in ${rashi(f.fifthSign)}, Mercury (speech and analysis, house ${f.mercuryHouse}) and the 4th house (early environment, sign ${rashi(f.fourthSign)}). A calm, structured home and encouragement of the child's own interests matter far more than early drilling.`,
      care: `This report offers only general, supportive guidance on care and routine — a stable daily rhythm, plenty of warmth, and a peaceful home, all of which this chart benefits from. For anything about your child's health or development, please rely on your paediatrician and not on astrology.`,
      milestones: `Growth phases can be read gently from the current ${f.currentDashaLord} dasha (to ${f.currentDashaEnd}) — periods that tend to bring change and development. Use these only as a broad sense of seasons, and never as fixed dates or predictions of events. Every child's path unfolds in its own time.`,
      remedies: `Gentle, positive practices for the parents: keep a steady daily routine around your child; offer blessings and gratitude; donate to causes linked to the Moon and Jupiter on their days; and keep the home calm and affectionate. Nothing here is fear-based — these are simple supportive habits.`,
      conclusion: `Overall, this chart is a warm and promising one for your child, and the reading is meant to encourage rather than predict. Nurture the strengths it shows, keep decisions with your family and doctors, and let your child grow at their own pace.`,
    };
  } else {
    const dosha =
      f.mangalDosha === true
        ? "Mangal dosha is present from the ascendant."
        : f.mangalDosha === "mild"
          ? "A mild Mangal influence shows from the Moon only."
          : "No Mangal dosha is indicated.";
    const seventh = f.planetsInSeventh.length
      ? `With ${f.planetsInSeventh.join(", ")} in the 7th house, relationships carry extra weight and need conscious handling.`
      : "The 7th house is unoccupied, so the 7th lord carries the main message.";
    map = {
      timing: `Your marriage timing is read from your 7th house in ${rashi(f.seventhSign)} and your current ${f.currentDashaLord} dasha (to ${f.currentDashaEnd}). The 7th lord ${f.seventhLord} sits in house ${f.seventhLordHouse}, which colours when and how commitment unfolds. Periods that activate the 7th house or its lord, and the Venus/Jupiter sub-periods, are the strongest windows. Use these as direction, not fixed dates.`,
      partner: `The 7th house in ${rashi(f.seventhSign)}, ruled by ${f.seventhLord} placed in house ${f.seventhLordHouse}, points to the temperament of a suitable partner and where you are likely to meet them. ${seventh} Look for someone who matches this flavour rather than a checklist.`,
      venusJupiter: `Venus, the karaka of love, is in ${rashi(f.venusSign)} in house ${f.venusHouse}, which shapes how you give and receive affection. Jupiter in ${rashi(f.jupiterSign)} in house ${f.jupiterHouse} shows your deeper values and expectations in marriage. Read these together: they show what you truly need, beyond attraction.`,
      doshas: `${dosha} A single factor never decides a marriage. Temperament, mutual consent, family context and shared expectations carry equal weight.`,
      marriedLife: `Married life is read from the 7th house and its lord. ${seventh} Calm, direct communication — saying the difficult thing early rather than storing it — keeps this placement constructive.`,
      finance: `Money and home after marriage are read from the 2nd, 4th and 11th houses supported by Jupiter's placement. Jupiter in house ${f.jupiterHouse} suggests where steady, durable gains are likely, provided speculative leaps are avoided.`,
      remedies: `Practical supports for this chart: keep a steady daily routine; respect elders and family obligations; donate to causes linked to Jupiter on Thursdays; avoid impulsive financial risks, especially in Rahu periods; and make major relationship decisions after a cooling-off period, not in the heat of the moment.`,
      conclusion: `Overall, this chart supports marriage; the work is in timing and communication rather than in any single hard placement. ${dosha} Let the reading guide your attention, and always decide with the person in front of you.`,
    };
  }

  return ids.map((id) => ({ id, body: map[id] }));
}

/**
 * Generate the full report for a type. Always returns every section: on any LLM
 * failure it falls back to the deterministic assembly above, so a verified
 * payment is never met with an empty page.
 */
export async function generateFullReport(
  kundli: KundliResult,
  locale: string,
  type: ReportType = "marriage"
): Promise<ReportSection[]> {
  const facts = buildFacts(kundli);
  const ids = REPORT_SECTIONS[type];
  try {
    const { text } = await chatCompletion({
      messages: [
        { role: "system", content: systemPrompt(type) },
        { role: "user", content: buildPrompt(type, facts, locale) },
      ],
      maxTokens: 8000,
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
      const complete = ids
        .map((id) => ({ id, body: byId.get(id) ?? "" }))
        .filter((s) => s.body);
      if (complete.length === ids.length) return complete;
    }
  } catch (err) {
    console.warn("[report] LLM generation failed:", (err as Error).message);
  }
  return fallbackSections(type, facts);
}

/**
 * Keep only well-formed sections with known ids, in canonical order. Anything
 * the model (or a client) invents is dropped; a partial set is treated as no
 * set so the caller regenerates rather than serving a half report.
 */
function normalizeSections(
  raw: unknown,
  type: ReportType
): ReportSection[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = REPORT_SECTIONS[type];
  const byId = new Map<string, string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, body } = item as { id?: unknown; body?: unknown };
    if (typeof id !== "string" || typeof body !== "string") continue;
    if (!ids.includes(id)) continue;
    if (!body.trim()) continue;
    byId.set(id, body);
  }
  const sections = ids
    .map((id) => ({ id, body: byId.get(id) ?? "" }))
    .filter((s) => s.body);
  return sections.length === ids.length ? sections : null;
}

/** The stored narrative for this device+pack, or null. Best-effort read. */
export async function getStoredReport(
  deviceId: string,
  packId: string,
  type: ReportType = "marriage"
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
    return normalizeSections(data?.sections, type);
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
  type: ReportType;
  facts: ReportFacts;
  sections: ReportSection[];
}): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin || !params.deviceId) return false;
  const sections = normalizeSections(params.sections, params.type);
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
