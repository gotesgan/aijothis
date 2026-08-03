import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { buildOverviewPrompt } from "@/lib/prompt";
import { computeTransits } from "@/lib/transit";
import { getChartFocus } from "@/lib/routing";
import { retrieveVedicContext } from "@/lib/rag";
import type { KundliResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECTIONS = ["personality", "career", "marriage", "wealth", "health"] as const;
export type Overview = Record<(typeof SECTIONS)[number], string>;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { kundli, lang }: { kundli: KundliResult; lang: string } = body ?? {};

  if (!kundli) {
    return NextResponse.json({ error: "missing_kundli" }, { status: 400 });
  }

  const now = new Date();
  const transits = await computeTransits(now).catch(() => undefined);
  const vedic = retrieveVedicContext({ focus: getChartFocus("general"), kundli, max: 5 });

  const prompt = buildOverviewPrompt(kundli, lang ?? "en", now, transits, vedic);

  try {
    const { text, usage } = await chatCompletion({
      messages: [
        { role: "system", content: "You are Arya, a precise, warm Vedic astrologer. You always return valid JSON." },
        { role: "user", content: prompt },
      ],
      // DeepSeek v4-flash reasons heavily on report tasks — give it room so
      // the actual JSON survives the hidden reasoning budget.
      maxTokens: 8192,
    });

    console.log(
      `[aryad] overview lang=${lang} prompt=${usage?.promptTokens ?? "-"} completion=${usage?.completionTokens ?? "-"} reasoning=${usage?.reasoningTokens ?? "-"}`
    );

    const overview = parseOverview(text);
    if (SECTIONS.every((s) => overview[s])) {
      return NextResponse.json({ overview });
    }
    return NextResponse.json(
      { error: "overview_parse_failed", raw: text.slice(0, 300) },
      { status: 422 }
    );
  } catch (err) {
    console.error("overview generation failed", err);
    return NextResponse.json(
      { error: "generation_failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}

function parseOverview(text: string): Overview {
  const out = { personality: "", career: "", marriage: "", wealth: "", health: "" };
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      for (const s of SECTIONS) {
        const v = parsed[s];
        if (typeof v === "string" && v.trim().length > 5) out[s] = v.trim();
      }
    } catch {
      // fall through
    }
  }
  return out;
}
