import { getSwe, normalizeLon, NAKSHATRA_NAMES } from "./kundli";

/**
 * Free, offline Vedic panchang computation.
 *
 * Tithi, Nakshatra, Yoga and Karana are pure functions of the sidereal
 * Sun/Moon longitudes at an instant — computed here with the same Swiss
 * Ephemeris instance (Lahiri ayanamsa) used for charts. Zero API cost,
 * deterministic, and consistent with the rest of the app.
 */

const ELONGATION = (moonLon: number, sunLon: number) =>
  normalizeLon(moonLon - sunLon);

export const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Amavasya",
];

export const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

const REPEATING_KARANA = [
  "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti",
];

const FIXED_KARANA = ["Shakuni", "Chatushpada", "Naga", "Kintughna"];

export interface Panchang {
  date: string; // YYYY-MM-DD (UTC date of the instant)
  tithi: { index: number; name: string; paksha: "Shukla" | "Krishna" };
  nakshatra: { index: number; name: string };
  yoga: { index: number; name: string };
  karana: { index: number; name: string };
}

/** Panchang for an instant, computed from sidereal Sun/Moon longitudes. */
export async function getPanchang(instant: Date): Promise<Panchang> {
  const swe = await getSwe();
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL;

  const { julianDayUT } = swe.utc_to_jd(
    instant.getUTCFullYear(),
    instant.getUTCMonth() + 1,
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
    instant.getUTCSeconds(),
    swe.SE_GREG_CAL
  );

  const sunLon = normalizeLon(swe.calc_ut(julianDayUT, swe.SE_SUN, flags)[0]);
  const moonLon = normalizeLon(swe.calc_ut(julianDayUT, swe.SE_MOON, flags)[0]);

  const elong = ELONGATION(moonLon, sunLon);

  // Tithi: 12° per tithi, 30 in a lunar month.
  const tithiIndex = Math.floor(elong / 12);
  const tithiNum = (tithiIndex % 30) + 1;
  const tithiName = TITHI_NAMES[tithiNum - 1];
  const paksha = tithiNum <= 15 ? "Shukla" : "Krishna";

  // Nakshatra: 360/27° per nakshatra from Moon's longitude.
  const nakshatraIndex = Math.floor(moonLon / (360 / 27));
  const nakshatraName = NAKSHATRA_NAMES[nakshatraIndex];

  // Yoga: 13°20' (360/27) per yoga from Sun+Moon.
  const yogaIndex = Math.floor(normalizeLon(sunLon + moonLon) / (360 / 27));
  const yogaName = YOGA_NAMES[yogaIndex];

  // Karana: 6° per karana. Classically the 7 movable karanas start after the
  // fixed Kintughna at elong [0,6); the last three fixed (Shakuni,
  // Chatushpada, Naga) sit at the very end of the month.
  let karanaName: string;
  if (elong < 6) {
    karanaName = "Kintughna";
  } else if (elong >= 342) {
    karanaName = FIXED_KARANA[Math.min(Math.floor((elong - 342) / 6), 3)];
  } else {
    const kIndex = Math.floor((elong - 6) / 6);
    karanaName = REPEATING_KARANA[kIndex % REPEATING_KARANA.length];
  }
  const karanaIndex = Math.floor(elong / 6) + 1;

  return {
    date: instant.toISOString().slice(0, 10),
    tithi: { index: tithiNum, name: tithiName, paksha },
    nakshatra: { index: nakshatraIndex + 1, name: nakshatraName },
    yoga: { index: yogaIndex + 1, name: yogaName },
    karana: { index: karanaIndex + 1, name: karanaName },
  };
}

/** Compact, prompt-ready summary of a Panchang. */
export function formatPanchang(p: Panchang): string {
  return `${p.tithi.paksha} Paksha, ${p.tithi.name} (tithi ${p.tithi.index}/30) · Nakshatra ${p.nakshatra.name} (${p.nakshatra.index}/27) · Yoga ${p.yoga.name} (${p.yoga.index}/27) · Karana ${p.karana.name}`;
}
