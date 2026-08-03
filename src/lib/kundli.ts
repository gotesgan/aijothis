import SwissEph from "swisseph-wasm";
import type {
  BirthDetails,
  DashaPeriod,
  KundliResult,
  PlanetPosition,
} from "./types";

/* ────────────────────────────────────────────────
   Swiss Ephemeris (WASM) — Vedic / sidereal engine
   Lahiri ayanamsa · Whole-sign houses (North Indian)
   ──────────────────────────────────────────────── */

export const RASHI_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

export const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const DASHA_LORDS = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
const NAKSHATRA_SPAN = 360 / 27;
const SIDEREAL_FLAGS = 2 | 65536 | 256; // SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_SPEED

const PLANET_DEFS = [
  { id: "sun", symbol: "☉", se: 0, name: "Sun" },
  { id: "moon", symbol: "☽", se: 1, name: "Moon" },
  { id: "mars", symbol: "♂", se: 4, name: "Mars" },
  { id: "mercury", symbol: "☿", se: 2, name: "Mercury" },
  { id: "jupiter", symbol: "♃", se: 5, name: "Jupiter" },
  { id: "venus", symbol: "♀", se: 3, name: "Venus" },
  { id: "saturn", symbol: "♄", se: 6, name: "Saturn" },
  { id: "rahu", symbol: "☊", se: 11, name: "Rahu" }, // true node
  { id: "ketu", symbol: "☋", se: -1, name: "Ketu" },
];

let instance: SwissEph | null = null;
let initPromise: Promise<SwissEph> | null = null;

export async function getSwe(): Promise<SwissEph> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = (async () => {
      const swe = new SwissEph();
      await swe.initSwissEph();
      swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
      instance = swe;
      return swe;
    })();
  }
  return initPromise;
}

export function normalizeLon(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Offset (in minutes east of UTC) for the given timezone on the given date.
 * Uses the Intl API so DST / historical offsets are respected.
 */
export function getUtcOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const part = dtf
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = part?.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return 0;
    const sign = m[1] === "+" ? 1 : -1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  } catch {
    return 0;
  }
}

function localToUtcParts(
  date: string,
  time: string,
  offsetMinutes: number
): { y: number; m: number; d: number; hh: number; mm: number } {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utcMs =
    Date.UTC(y, m - 1, d, hh, mm, 0) - offsetMinutes * 60_000;
  const dt = new Date(utcMs);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    hh: dt.getUTCHours(),
    mm: dt.getUTCMinutes(),
  };
}

export async function computeKundli(
  input: BirthDetails
): Promise<KundliResult> {
  const swe = await getSwe();

  const { y, m, d, hh, mm } = localToUtcParts(
    input.date,
    input.time,
    input.utcOffsetMinutes
  );

  const { julianDayUT } = swe.utc_to_jd(y, m, d, hh, mm, 0, swe.SE_GREG_CAL);
  const jd = julianDayUT;

  const houses = swe.houses_ex(jd, SIDEREAL_FLAGS, input.lat, input.lng, "W");
  const lagnaLongitude = normalizeLon(houses.ascmc[0]);
  const mcLongitude = normalizeLon(houses.ascmc[1]);
  const ayanamsa = swe.get_ayanamsa_ut(jd);
  const lagnaRashi = Math.floor(lagnaLongitude / 30);
  const mcRashi = Math.floor(mcLongitude / 30);

  // Planets
  let rahuLon = 0;
  const planets: PlanetPosition[] = [];

  for (const def of PLANET_DEFS) {
    let longitude: number;
    let speed = 0;

    if (def.se === -1) {
      // Ketu = Rahu + 180
      longitude = normalizeLon(rahuLon + 180);
      speed = -0.05; // nodes always move retrograde
    } else {
      const res = swe.calc_ut(jd, def.se, SIDEREAL_FLAGS);
      longitude = normalizeLon(res[0]);
      speed = res[3];
      if (def.id === "rahu") rahuLon = longitude;
    }

    planets.push({
      id: def.id,
      symbol: def.symbol,
      name: def.name,
      longitude: round2(longitude),
      rashi: Math.floor(longitude / 30),
      degree: round2(longitude % 30),
      house: ((Math.floor(longitude / 30) - lagnaRashi + 12) % 12) + 1,
      retrograde: speed < -0.0001,
    });
  }

  const moon = planets.find((p) => p.id === "moon")!;
  const sun = planets.find((p) => p.id === "sun")!;
  const moonNakshatra = Math.floor(moon.longitude / NAKSHATRA_SPAN);
  const moonNakshatraPad =
    Math.floor(
      (moon.longitude % NAKSHATRA_SPAN) / (NAKSHATRA_SPAN / 4)
    ) + 1;

  // ── Vimshottari Dasha ─────────────────────────
  const startLordIndex = moonNakshatra % 9;
  const fractionElapsed =
    (moon.longitude % NAKSHATRA_SPAN) / NAKSHATRA_SPAN;
  const balanceYears = (1 - fractionElapsed) * DASHA_YEARS[startLordIndex];

  const birthMs = Date.UTC(y, m - 1, d, hh, mm);
  const periods: DashaPeriod[] = [];
  let cursor = new Date(birthMs);

  for (let k = 0; k < 9; k++) {
    const idx = (startLordIndex + k) % 9;
    const years = k === 0 ? balanceYears : DASHA_YEARS[idx];
    const start = cursor;
    cursor = new Date(start.getTime() + years * 365.25 * 86_400_000);
    periods.push({
      lord: DASHA_LORDS[idx],
      years: round2(years),
      start: start.toISOString().slice(0, 10),
      end: cursor.toISOString().slice(0, 10),
      current: false,
    });
  }

  let elapsedYears = (Date.now() - birthMs) / (365.25 * 86_400_000);
  let currentIndex = 0;
  for (let k = 0; k < periods.length; k++) {
    if (elapsedYears < periods[k].years) {
      currentIndex = k;
      break;
    }
    elapsedYears -= periods[k].years;
  }
  if (currentIndex >= periods.length) currentIndex = periods.length - 1;
  periods[currentIndex].current = true;

  return {
    profile: {
      name: input.name,
      date: input.date,
      time: input.time,
      place: input.place,
      lat: input.lat,
      lng: input.lng,
      timezone: input.timezone,
    },
    computed: {
      julianDay: jd,
      ayanamsa: round2(ayanamsa),
      lagnaLongitude: round2(lagnaLongitude),
      lagnaRashi,
      moonRashi: moon.rashi,
      moonNakshatra,
      moonNakshatraPad,
      sunRashi: sun.rashi,
      mcRashi,
    },
    planets,
    dasha: {
      balanceYears: round2(balanceYears),
      currentIndex,
      periods,
    },
  };
}
