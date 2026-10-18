/* ── Navagraha colour, in one place ──────────────────────────
   The chart, the weekday ruler, the today-list legend and the lucky-colour
   swatch all tint planets, and they used to hold four separate copies of the
   same nine hex values — which is how they drifted apart. The values now live
   in globals.css as `--planet-*`, so there is exactly one definition.

   This module deliberately has no imports: today.ts pulls in Swiss Ephemeris
   (a wasm module) and kundli-chart is a client component, so a shared map
   must not transitively drag the ephemeris into the browser bundle. */

export const PLANET_COLOR: Record<string, string> = {
  sun: "var(--planet-sun)",
  moon: "var(--planet-moon)",
  mars: "var(--planet-mars)",
  mercury: "var(--planet-mercury)",
  jupiter: "var(--planet-jupiter)",
  venus: "var(--planet-venus)",
  saturn: "var(--planet-saturn)",
  rahu: "var(--planet-rahu)",
  ketu: "var(--planet-ketu)",
};

/* The same planets as words, for the one place that needs prose rather than a
   colour value: `getDayMeta().luckyColor` is interpolated into the day-reading
   model prompt ("Suggested lucky color: …"). A CSS value like
   `var(--planet-sun)` would be nonsense there, and always was when it was a
   raw hex code. */
export const PLANET_COLOR_NAME: Record<string, string> = {
  sun: "warm amber",
  moon: "pearl white",
  mars: "soft terracotta",
  mercury: "sage green",
  jupiter: "muted gold",
  venus: "dusty rose",
  saturn: "soft blue",
  rahu: "smoky violet",
  ketu: "pale lavender",
};
