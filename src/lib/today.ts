import { getSwe, normalizeLon } from "./kundli";
import type { KundliResult } from "./types";

/* ── Weekday rulers (traditional) + lucky color per ruler ── */

export const WEEKDAY_RULER: Record<number, string> = {
  0: "sun", 1: "moon", 2: "mars", 3: "mercury",
  4: "jupiter", 5: "venus", 6: "saturn",
};

export const RULER_COLOR: Record<string, string> = {
  sun: "#ff9a4d",
  moon: "#e9e4d2",
  mars: "#ff6b5e",
  mercury: "#7fe08f",
  jupiter: "#ffd45c",
  venus: "#ff9fc0",
  saturn: "#7fb2ff",
};

export function getDayMeta(now: Date) {
  const weekdayId = now.getUTCDay();
  const rulerId = WEEKDAY_RULER[weekdayId] ?? "sun";
  return {
    weekdayId,
    rulerId,
    luckyColor: RULER_COLOR[rulerId] ?? "#f2c94c",
  };
}

/* ── Upcoming transit events (next N days) ── */

export interface UpcomingEvent {
  date: string; // YYYY-MM-DD
  type: "ingress" | "conjunction";
  planetId: string;
  sign?: number; // for ingress — the sign being entered
  natalId?: string; // for conjunction — the natal planet aligned with
}

const FAST_PLANETS = [
  { id: "sun", se: 0 },
  { id: "mercury", se: 2 },
  { id: "venus", se: 3 },
  { id: "mars", se: 4 },
];

const ALL_TRANSIT = [
  { id: "sun", se: 0 },
  { id: "mercury", se: 2 },
  { id: "venus", se: 3 },
  { id: "mars", se: 4 },
  { id: "jupiter", se: 5 },
  { id: "saturn", se: 6 },
  { id: "rahu", se: 11 },
];

const ORB = 2.5; // degrees for conjunction

/**
 * Finds notable upcoming transits in the next `days` days:
 *  - fast planets entering a new rashi (ingress)
 *  - any transit planet aligning within ORB° of a natal planet (conjunction)
 */
export async function computeUpcoming(
  kundli: KundliResult,
  now: Date,
  days = 12
): Promise<UpcomingEvent[]> {
  const swe = await getSwe();
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL;
  const events: UpcomingEvent[] = [];

  async function lonAt(date: Date, se: number): Promise<number> {
    const { julianDayUT } = swe.utc_to_jd(
      date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
      0, 0, 0, swe.SE_GREG_CAL
    );
    return normalizeLon(swe.calc_ut(julianDayUT, se, flags)[0]);
  }

  // ingresses (fast planets)
  for (const p of FAST_PLANETS) {
    let prevSign: number | null = null;
    for (let d = 1; d <= days; d++) {
      const date = new Date(now.getTime() + d * 86_400_000);
      const lon = await lonAt(date, p.se);
      const sign = Math.floor(lon / 30);
      if (prevSign !== null && sign !== prevSign) {
        events.push({ date: date.toISOString().slice(0, 10), type: "ingress", planetId: p.id, sign });
      }
      prevSign = sign;
    }
  }

  // conjunctions with natal planets
  const natal = kundli.planets.map((p) => ({ id: p.id, lon: p.longitude }));
  for (const tp of ALL_TRANSIT) {
    for (let d = 1; d <= days; d++) {
      const date = new Date(now.getTime() + d * 86_400_000);
      const lon = await lonAt(date, tp.se);
      for (const np of natal) {
        let sep = Math.abs(lon - np.lon);
        sep = Math.min(sep, 360 - sep);
        if (sep < ORB) {
          events.push({
            date: date.toISOString().slice(0, 10),
            type: "conjunction",
            planetId: tp.id,
            natalId: np.id,
          });
          break;
        }
      }
    }
  }

  return mergeEvents(events);
}

/** Collapses a multi-day conjunction window into a single event. */
function mergeEvents(events: UpcomingEvent[]): UpcomingEvent[] {
  const sorted = events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)
  );
  const merged: UpcomingEvent[] = [];
  for (const e of sorted) {
    const prev = merged[merged.length - 1];
    const same = prev && e.type === prev.type && e.planetId === prev.planetId && e.natalId === prev.natalId;
    if (same) {
      const anchor = Date.parse(prev.date);
      const cur = Date.parse(e.date);
      if (cur - anchor <= 3 * 86_400_000) continue; // same window — keep first
    }
    merged.push(e);
  }
  return merged.slice(0, 6);
}
