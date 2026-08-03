import type { KundliResult } from "./types";
import type { ChartFocus } from "./routing";
import { VEDIC_CORPUS } from "./vedic-corpus";

/**
 * RAG retrieval node.
 *
 * Scores the curated Vedic corpus against the user's topic, focus factors,
 * nakshatra and current Dasha lord, and returns the most relevant entries
 * to ground Arya's answer. In-memory scoring is instant and free; swap for
 * pgvector once the knowledge base grows.
 */
export function retrieveVedicContext(params: {
  focus: ChartFocus;
  kundli: KundliResult;
  max?: number;
}): string[] {
  const { focus, kundli } = params;
  const max = params.max ?? 4;
  const c = kundli.computed;
  const dashaLord = kundli.dasha.periods.find((p) => p.current)?.lord.toLowerCase();

  const scored = VEDIC_CORPUS.map((entry) => {
    let score = 0;

    if (entry.topics.includes(focus.topic)) score += 3;

    const tags = new Set(entry.tags);
    for (const pid of focus.planetIds) if (tags.has(pid)) score += 2;
    for (const h of focus.houses) if (tags.has(`h${h}`)) score += 2;
    if (dashaLord && tags.has(dashaLord)) score += 2;
    if (tags.has(`nak${c.moonNakshatra}`)) score += 3;

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.entry.content);
}

export function formatVedicContext(chunks: string[]): string {
  if (chunks.length === 0) return "";
  return chunks.map((c, i) => `${i + 1}. ${c}`).join("\n");
}
