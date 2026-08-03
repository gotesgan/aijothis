import { RASHI_GLYPH, PLANET_GLYPH } from "@/lib/glyphs";

const RASHIS = RASHI_GLYPH;
const NAVAGRAHA = [
  PLANET_GLYPH.sun, PLANET_GLYPH.moon, PLANET_GLYPH.mars, PLANET_GLYPH.mercury,
  PLANET_GLYPH.jupiter, PLANET_GLYPH.venus, PLANET_GLYPH.saturn,
  PLANET_GLYPH.rahu, PLANET_GLYPH.ketu,
];

function ringPositions(
  count: number,
  radius: number,
  cx: number,
  cy: number
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((360 / count) * i - 90) * (Math.PI / 180);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

/**
 * The signature element: a slowly rotating navagraha mandala.
 * Twelve rashi glyphs orbit the outer dial, the nine planetary forces
 * turn the inner ring, and ॐ sits at the hub — the subject itself.
 */
export function NavagrahaMandala() {
  const cx = 150;
  const cy = 150;
  const rashi = ringPositions(RASHIS.length, 118, cx, cy);
  const graha = ringPositions(NAVAGRAHA.length, 74, cx, cy);

  return (
    <div className="mandala" aria-hidden="true">
      <svg viewBox="0 0 300 300" className="mandala__svg">
        {/* outer dial */}
        <circle className="mandala__tick" cx={cx} cy={cy} r={132} />
        <circle className="mandala__hub" cx={cx} cy={cy} r={94} />
        <circle className="mandala__hub" cx={cx} cy={cy} r={52} />

        {/* rotating rashi ring */}
        <g className="mandala__ring">
          {rashi.map((p, i) => (
            <text key={i} className="mandala__rashi" x={p.x} y={p.y}>
              {RASHIS[i]}
            </text>
          ))}
        </g>

        {/* rotating navagraha ring (reverse) */}
        <g className="mandala__ring mandala__ring--reverse">
          {graha.map((p, i) => (
            <text key={i} className="mandala__planet" x={p.x} y={p.y}>
              {NAVAGRAHA[i]}
            </text>
          ))}
        </g>

        {/* hub */}
        <text className="mandala__om" x={cx} y={cy + 1}>
          ॐ
        </text>
      </svg>
    </div>
  );
}
