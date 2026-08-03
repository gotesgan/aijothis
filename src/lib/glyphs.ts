/* Astrological glyph strings, forced to TEXT presentation (U+FE0E) so
   they render as clean monochrome line glyphs instead of emoji.
   Combined with a symbol-font stack (see .astro-glyph in globals.css)
   this gives consistent, on-brand glyphs across platforms. */

const FE = "\uFE0E"; // VARIATION SELECTOR-15 — force text presentation

export const PLANET_GLYPH: Record<string, string> = {
  sun: `☉${FE}`,
  moon: `☽${FE}`,
  mars: `♂${FE}`,
  mercury: `☿${FE}`,
  jupiter: `♃${FE}`,
  venus: `♀${FE}`,
  saturn: `♄${FE}`,
  rahu: `☊${FE}`,
  ketu: `☋${FE}`,
};

export const RASHI_GLYPH: string[] = [
  "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓",
].map((g) => `${g}${FE}`);

/** Glyph for a planet by its id (falls back to the raw symbol). */
export function glyphFor(id: string, fallback = ""): string {
  return PLANET_GLYPH[id] ?? fallback;
}
