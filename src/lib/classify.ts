/**
 * Classification node — one structured decision pass on every user message.
 *
 * Replaces the generative classifier (`guardInput`, a full DeepSeek call that
 * emitted one word as free text) with TypeSafe's System One model (Jev), which
 * is purpose-built for typed classification. A single request answers all four
 * questions in parallel:
 *
 *   - crisis  (noul)   → is this a self-harm / immediate-danger message?
 *   - soften  (choice) → is this third-party fixation / paranoia?
 *   - topic   (choice) → which life area (replaces the keyword router)?
 *   - lang    (choice) → detected language (en/hi/mr/other)
 *
 * DeepSeek is kept as the fallback: when TypeSafe is unconfigured, slow,
 * overloaded or down (503/"no healthy upstream" is a real failure mode), we
 * fall back to `guardInput` + the free keyword `classifyTopic`. The caller also
 * keeps the zero-cost regex guard in `safety.ts` as the instant first line.
 */

import { guardInput } from "./guard";
import { classifyTopic, type Topic } from "./routing";

export type ClassifySource = "typesafe" | "fallback";

export interface Classification {
  /** Self-harm / suicide / immediate danger (incl. paraphrases). */
  crisis: boolean;
  /** Third-party fixation / paranoia → inject PSYCH_DIRECTIVE. */
  soften: boolean;
  /** Life area for chart focus. */
  topic: Topic;
  /** Detected language: "en" | "hi" | "mr" | "other". */
  lang: string;
  /** TypeSafe confidence per answer (0 when served by the fallback). */
  confidence: {
    crisis: number;
    soften: number;
    topic: number;
    lang: number;
  };
  /** Which engine produced this verdict (for logs / experiments). */
  source: ClassifySource;
}

/* ── Config ──────────────────────────────────────────────────────────── */

const API_KEY =
  process.env.TYPESAFE_API_KEY ??
  process.env.Jev_ai ??
  process.env.JEV_AI ??
  process.env.jev_ai;

const BASE_URL =
  process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai/v1/systemone";

const MODEL = process.env.TYPESAFE_MODEL ?? "jev-latest";

/** Hard cap before we give up and fall back to DeepSeek. */
const TIMEOUT_MS = Number(process.env.TYPESAFE_TIMEOUT_MS ?? 1500);

/** Noul probability at/above which crisis is treated as true. */
const CRISIS_THRESHOLD = Number(process.env.TYPESAFE_CRISIS_THRESHOLD ?? 0.5);

export function typesafeConfigured(): boolean {
  return !!API_KEY;
}

/* ── Questions ───────────────────────────────────────────────────────── */

const TOPIC_CRITERIA: Record<Topic, string> = {
  love: "Romance, relationship, attraction, breakup, crush, affair",
  marriage: "Marriage, spouse, wedding, engagement, matchmaking",
  career: "Job, work, business, promotion, profession",
  money: "Wealth, income, finance, property, investment, debt",
  health: "Health, illness, disease, body, wellbeing",
  education: "Study, exams, admission, learning",
  panchang: "Daily tithi, panchang, muhurat, auspicious timing",
  general: "General life reading or none of the above",
};

const QUESTIONS = {
  crisis: {
    type: "noul",
    instructions:
      "Does this message indicate the user may be considering self-harm, suicide, or ending their life, or immediate danger to themselves or others — including indirect hints such as goodbye messages, giving away possessions, or not wanting to wake up? Judge the meaning, not keywords.",
  },
  soften: {
    type: "choice",
    instructions:
      "Is the user intensely fixated on what OTHER specific people think, feel, say or plan — suspicion of spying, jealousy, blackmail, black magic or harm by others, or 'everyone is talking about me'? Ordinary emotional or relationship questions are NOT soften.",
    criteria: {
      soften:
        "Intense fixation on others' thoughts/feelings/actions, suspicion, paranoia, or the same fixation repeated obsessively",
      pass: "Everything else, including normal astrology and ordinary emotional questions",
    },
  },
  topic: {
    type: "choice",
    instructions:
      "Which life area is this astrology question about, regardless of the language it is written in?",
    criteria: TOPIC_CRITERIA,
  },
  lang: {
    type: "choice",
    instructions: "What language is the user's message written in?",
    criteria: {
      en: "English",
      hi: "Hindi (Devanagari or romanized Hinglish)",
      mr: "Marathi (Devanagari or romanized)",
      other: "Any other language",
    },
  },
} as const;

/* ── TypeSafe response shapes ────────────────────────────────────────── */

interface NoulAnswer {
  type: "noul";
  noul: number;
}
interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}
interface TypesafeResponse {
  answers?: {
    crisis?: NoulAnswer;
    soften?: ChoiceAnswer;
    topic?: ChoiceAnswer;
    lang?: ChoiceAnswer;
  };
}

const TOPICS: readonly Topic[] = [
  "love",
  "marriage",
  "career",
  "money",
  "health",
  "education",
  "panchang",
  "general",
];

function isTopic(value: string | undefined): value is Topic {
  return !!value && (TOPICS as readonly string[]).includes(value);
}

/* ── Engines ─────────────────────────────────────────────────────────── */

async function classifyWithTypesafe(question: string): Promise<Classification> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        state: question.slice(0, 4000),
        model: MODEL,
        questions: QUESTIONS,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`typesafe ${res.status}: ${(await res.text()).slice(0, 120)}`);
    }

    const data = (await res.json()) as TypesafeResponse;
    const a = data.answers ?? {};

    return {
      crisis: (a.crisis?.noul ?? 0) >= CRISIS_THRESHOLD,
      soften: a.soften?.choice === "soften",
      topic: isTopic(a.topic?.choice) ? a.topic.choice : "general",
      lang: a.lang?.choice ?? "en",
      confidence: {
        crisis: a.crisis?.noul ?? 0,
        soften: a.soften?.confidence ?? 0,
        topic: a.topic?.confidence ?? 0,
        lang: a.lang?.confidence ?? 0,
      },
      source: "typesafe",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** DeepSeek guard + free keyword router — today's behavior, kept as fallback. */
async function classifyFallback(
  question: string,
  lang: string
): Promise<Classification> {
  const [guard, topic] = await Promise.all([
    guardInput(question, lang).catch(() => ({ action: "pass" as const })),
    Promise.resolve(classifyTopic(question)),
  ]);

  return {
    crisis: guard.action === "crisis",
    soften: guard.action === "soften",
    topic,
    lang: "en",
    confidence: { crisis: 0, soften: 0, topic: 0, lang: 0 },
    source: "fallback",
  };
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Classifies one user message. Never throws and never blocks for longer than
 * TIMEOUT_MS: on any TypeSafe failure it silently degrades to the DeepSeek
 * guard + keyword router.
 */
export async function classifyMessage(
  question: string,
  lang: string
): Promise<Classification> {
  const text = question?.trim() ?? "";
  if (text.length < 4) {
    return {
      crisis: false,
      soften: false,
      topic: "general",
      lang,
      confidence: { crisis: 0, soften: 0, topic: 0, lang: 0 },
      source: "fallback",
    };
  }

  if (!typesafeConfigured()) return classifyFallback(text, lang);

  try {
    const c = await classifyWithTypesafe(text);
    console.log(
      `[classify] source=typesafe topic=${c.topic} crisis=${c.crisis} ` +
        `soften=${c.soften} lang=${c.lang} ` +
        `conf[t=${c.confidence.topic.toFixed(2)} c=${c.confidence.crisis.toFixed(2)}]`
    );
    return c;
  } catch (err) {
    console.warn(
      `[classify] typesafe unavailable → deepseek fallback: ${(err as Error).message}`
    );
    return classifyFallback(text, lang);
  }
}
