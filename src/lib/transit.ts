import { getSwe, normalizeLon, round2, RASHI_NAMES } from "./kundli";

export interface TransitPosition {
  id: string;
  symbol: string;
  name: string;
  longitude: number; // sidereal
  rashi: number; // 0-11
  house: number; // house from lagna (gochar-to-natal-house), 1-12
}

const TRANSIT_PLANETS = [
  { id: "jupiter", symbol: "♃", name: "Jupiter", se: 5 },
  { id: "saturn", symbol: "♄", name: "Saturn", se: 6 },
  { id: "rahu", symbol: "☊", name: "Rahu", se: 11 },
  { id: "ketu", symbol: "☋", name: "Ketu", se: -1 },
  { id: "mars", symbol: "♂", name: "Mars", se: 4 },
  { id: "sun", symbol: "☉", name: "Sun", se: 0 },
  { id: "venus", symbol: "♀", name: "Venus", se: 3 },
  { id: "mercury", symbol: "☿", name: "Mercury", se: 2 },
  { id: "moon", symbol: "☽", name: "Moon", se: 1 },
];

/**
 * Real current sidereal (Lahiri) positions — the "transit tool node".
 * This is the gochar data Arya needs instead of guessing today's sky.
 */
export async function computeTransits(now: Date): Promise<TransitPosition[]> {
  const swe = await getSwe();
  const { julianDayUT } = swe.utc_to_jd(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    swe.SE_GREG_CAL
  );

  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL | swe.SEFLG_SPEED;
  const result: TransitPosition[] = [];
  let rahuLon = 0;

  for (const def of TRANSIT_PLANETS) {
    let longitude: number;
    if (def.se === -1) {
      longitude = normalizeLon(rahuLon + 180);
    } else {
      const res = swe.calc_ut(julianDayUT, def.se, flags);
      longitude = normalizeLon(res[0]);
      if (def.id === "rahu") rahuLon = longitude;
    }
    result.push({
      id: def.id,
      symbol: def.symbol,
      name: def.name,
      longitude: round2(longitude),
      rashi: Math.floor(longitude / 30),
      house: -1, // filled in per-user (relative to their lagna)
    });
  }
  return result;
}

/** Format a transit list for the prompt, relative to the user's lagna. */
export function formatTransits(
  transits: TransitPosition[],
  lagnaRashi: number
): string {
  return transits
    .map((t) => {
      const house = ((t.rashi - lagnaRashi + 12) % 12) + 1;
      return `${t.symbol} ${t.name}: ${RASHI_NAMES[t.rashi]} (${house}${ordinal(house)} house from Lagna)`;
    })
    .join("\n");
}

function ordinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}
