import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { computeTransits, formatTransits, type TransitPosition } from "@/lib/transit";
import { computeUpcoming, getDayMeta, type UpcomingEvent } from "@/lib/today";
import { getChartFocus } from "@/lib/routing";
import { retrieveVedicContext } from "@/lib/rag";
import type { KundliResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DailySummary {
  overall: string;
  career: string;
  love: string;
  money: string;
  health: string;
  insight: string;
  luckyTime: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { kundli, lang }: { kundli: KundliResult; lang: string } = body ?? {};

  if (!kundli) {
    return NextResponse.json({ error: "missing_kundli" }, { status: 400 });
  }

  const now = new Date();
  const [transits, upcoming, meta] = await Promise.all([
    computeTransits(now).catch(() => undefined),
    computeUpcoming(kundli, now).catch(() => []),
    Promise.resolve(getDayMeta(now)),
  ]);

  const focus = getChartFocus("general");
  const vedic = retrieveVedicContext({ focus, kundli, max: 3 });
  const prompt = buildTodayPrompt(kundli, lang ?? "en", now, meta, transits, upcoming, vedic);

  try {
    const { text, usage } = await chatCompletion({
      messages: [
        { role: "system", content: "You are Arya, a precise, warm Vedic astrologer. You always return valid JSON." },
        { role: "user", content: prompt },
      ],
      maxTokens: 8192,
    });

    console.log(
      `[aryad] today lang=${lang} prompt=${usage?.promptTokens ?? "-"} completion=${usage?.completionTokens ?? "-"} reasoning=${usage?.reasoningTokens ?? "-"}`
    );

    const summary = parseSummary(text);
    if (summary) {
      return NextResponse.json({
        date: now.toISOString().slice(0, 10),
        meta,
        luckyTime: summary.luckyTime,
        summary,
        influences: transits ?? [],
        upcoming,
      });
    }
    return NextResponse.json({ error: "parse_failed", raw: text.slice(0, 300) }, { status: 422 });
  } catch (err) {
    console.error("today generation failed", err);
    return NextResponse.json(
      { error: "generation_failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}

function buildTodayPrompt(
  kundli: KundliResult,
  lang: string,
  now: Date,
  meta: { rulerId: string; luckyColor: string },
  transits: TransitPosition[] | undefined,
  upcoming: UpcomingEvent[],
  vedic: string[]
): string {
  const c = kundli.computed;
  const langName = lang === "hi" ? "Hindi" : lang === "mr" ? "Marathi" : "English";
  const tz = kundli.profile.timezone || "Asia/Kolkata";
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long", timeZone: tz });

  const transitText = transits?.length
    ? formatTransits(transits, c.lagnaRashi)
    : "not computed";
  const upcomingText =
    upcoming.length > 0
      ? upcoming
          .map((e) =>
            e.type === "ingress"
              ? `${e.date}: ${e.planetId} enters a new rashi (sign index ${e.sign})`
              : `${e.date}: ${e.planetId} aligns with natal ${e.natalId}`
          )
          .join("\n")
      : "no major shifts expected in the next 12 days";
  const vedicText = vedic.length ? vedic.join("\n") : "none";

  return `You are Arya writing today's personalised Vedic daily reading for ${
    kundli.profile.name || "the user"
  }.

CHART: Lagna ${c.lagnaRashi}, Moon ${c.moonRashi} (nakshatra ${c.moonNakshatra}), Sun ${c.sunRashi}.
PLANETS: ${kundli.planets
    .map((p) => `${p.name} in ${p.house}th house`)
    .join(", ")}.
Current Mahadasha: ${
    kundli.dasha.periods.find((p) => p.current)?.lord ?? "unknown"
  }.

TODAY (${weekday} in ${tz}): ${now.toISOString().slice(0, 10)}.
Today's day-ruler planet: ${meta.rulerId}. Suggested lucky color: ${meta.luckyColor}.

TODAY'S TRANSITS (house from Lagna):
${transitText}

COMING UP (next ~12 days):
${upcomingText}

VEDIC CONTEXT:
${vedicText}

Write today's reading in ${langName}. For Hindi/Marathi: write in Devanagari with a natural Hinglish/Maralish mix — keep common English words (career, job, love, money, health, lucky, today) in English, casual friendly tone. Return ONLY valid JSON (no markdown, no code fences) with EXACTLY these keys:
{"overall":"...","career":"...","love":"...","money":"...","health":"...","insight":"...","luckyTime":"..."}

Rules:
- overall: 2-3 sentences on today's energy for this person (chart + transit specific).
- career/love/money/health: ONE short line each (under 25 words), specific to their placements and today's transits — never generic.
- insight: one practical, actionable tip for today (1-2 sentences).
- luckyTime: a short local time window today, e.g. "9:30–11:00 AM".
- Reference specific planets/houses/transits (e.g. "Jupiter transiting your 11th house").`;
}

function parseSummary(text: string): DailySummary | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]);
    const keys = ["overall", "career", "love", "money", "health", "insight", "luckyTime"] as const;
    const out = {} as DailySummary;
    for (const k of keys) {
      const v = p[k];
      if (typeof v !== "string" || !v.trim()) return null;
      out[k] = v.trim();
    }
    return out;
  } catch {
    return null;
  }
}
