"use client";

import { useLocale } from "next-intl";
import type { KundliResult, PlanetPosition } from "@/lib/types";
import { PLANET } from "@/lib/local-names";
import type { Locale } from "@/i18n/routing";
import { glyphFor, RASHI_GLYPH } from "@/lib/glyphs";

/* Classic North Indian chart — square 0..300, center (150,150).
   The inner diamond touches the 4 edge midpoints; the 4 corners are
   split into 2 triangles each. All 12 houses are triangles. */
const HOUSES: Record<number, [number, number][]> = {
  1: [[150, 0], [300, 150], [0, 150]],
  2: [[150, 0], [300, 0], [225, 75]],
  3: [[300, 0], [300, 150], [225, 75]],
  4: [[300, 150], [150, 300], [150, 0]],
  5: [[150, 300], [300, 300], [225, 225]],
  6: [[300, 300], [300, 150], [225, 225]],
  7: [[150, 300], [0, 150], [300, 150]],
  8: [[150, 300], [0, 300], [75, 225]],
  9: [[0, 300], [0, 150], [75, 225]],
  10: [[0, 150], [150, 300], [150, 0]],
  11: [[0, 150], [0, 0], [75, 75]],
  12: [[0, 0], [150, 0], [75, 75]],
};

/* The vertex of each house that points outward (on the square boundary). */
const OUTER: Record<number, [number, number]> = {
  1: [150, 0],
  2: [300, 0],
  3: [300, 0],
  4: [300, 150],
  5: [300, 300],
  6: [300, 300],
  7: [150, 300],
  8: [0, 300],
  9: [0, 300],
  10: [0, 150],
  11: [0, 0],
   12: [0, 0],
};

/* Navagraha colors (approximate traditional), tuned for the dark surface. */
const PLANET_COLORS: Record<string, string> = {
  sun: "#ff9a4d",
  moon: "#e9e4d2",
  mars: "#ff6b5e",
  mercury: "#7fe08f",
  jupiter: "#ffd45c",
  venus: "#ff9fc0",
  saturn: "#7fb2ff",
  rahu: "#9fb3d8",
  ketu: "#c2a6ea",
};

function centroid(points: [number, number][]): [number, number] {
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}

function lerp(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Traditional placement: the rashi badge sits near the house's outer point,
 * planets spread across the two inner corners and the centroid.
 */
function houseLayout(n: number) {
  const points = HOUSES[n];
  const [cx, cy] = centroid(points);
  const outer = OUTER[n];
  const rashi = lerp(outer, [cx, cy], 0.62);
  const anchors = points
    .filter((p) => p[0] !== outer[0] || p[1] !== outer[1])
    .map((p) => lerp(p, [cx, cy], 0.52));
  return { rashi, anchors: [...anchors, [cx, cy] as [number, number]] };
}

export function KundliChart({ kundli }: { kundli: KundliResult }) {
  const locale = (useLocale() as Locale) ?? "en";
  const planetNames = PLANET[locale];
  const lagnaRashi = kundli.computed.lagnaRashi;

  const byHouse: Record<number, PlanetPosition[]> = {};
  for (const p of kundli.planets) {
    (byHouse[p.house] ??= []).push(p);
  }

  return (
    <>
      <svg viewBox="0 0 300 300" className="chart-svg" role="img" aria-label="North Indian birth chart">
      <defs>
        <radialGradient id="chartGlow" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="rgba(255,184,77,0.10)" />
          <stop offset="60%" stopColor="rgba(255,184,77,0.03)" />
          <stop offset="100%" stopColor="rgba(255,184,77,0)" />
        </radialGradient>
        <filter id="planetGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ambient center glow */}
      <rect x="0" y="0" width="300" height="300" fill="url(#chartGlow)" />

      {/* houses */}
      {Object.entries(HOUSES).map(([key, points]) => {
        const n = Number(key);
        const rashi = (lagnaRashi + n - 1) % 12;
        const planets = byHouse[n] ?? [];
        const poly = points.map((p) => p.join(",")).join(" ");
        const { rashi: rPos, anchors } = houseLayout(n);

        return (
          <g key={n}>
            <polygon
              className={`chart-house ${n === 1 ? "chart-house--lagna" : ""}`}
              points={poly}
            />

            {/* rashi badge */}
            <g
              transform={`translate(${rPos[0]} ${rPos[1]})`}
              className="chart-rashi-badge"
            >
              <rect x="-15" y="-10" width="30" height="20" rx="10" />
              <text y="3.5">
                {RASHI_GLYPH[rashi]} {rashi + 1}
              </text>
            </g>

            {/* planets */}
            {planets.map((p, i) => {
              const [x, y] = anchors[Math.min(i, anchors.length - 1)];
              const color = PLANET_COLORS[p.id] ?? "#f2c94c";
              return (
                <g
                  key={p.id}
                  transform={`translate(${x} ${y})`}
                  className="chart-planet"
                >
                  <circle r="9.5" fill="rgba(13,10,22,0.55)" stroke={color} strokeWidth="1" opacity="0.9" />
                  <text
                    y="0.5"
                    fill={color}
                    style={{ filter: "url(#planetGlow)" }}
                  >
                    {glyphFor(p.id, p.symbol)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>

    {/* navagraha legend */}
    <div className="chart-legend">
      {kundli.planets.map((p) => (
        <span className="chart-legend__item" key={p.id}>
          <span
            className="chart-legend__glyph"
            style={{ color: PLANET_COLORS[p.id] ?? "#f2c94c" }}
          >
            {glyphFor(p.id, p.symbol)}
          </span>
          {planetNames[p.id] ?? p.name}
        </span>
      ))}
    </div>
    </>
  );
}
