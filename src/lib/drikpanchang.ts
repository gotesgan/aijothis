import { getUtcOffsetMinutes } from "./kundli";

/**
 * Lazy drikPanchang (freeastroapi.com) client.
 *
 * STRICTLY lazy: this module is a no-op unless `DRIKPANCHANG_API_KEY` is
 * set, and even then the caller must only invoke it for panchang/muhurat
 * questions (see /api/chat routing). Calls are cached per
 * (date, timezone, lat, lng) so a given day+place hits the API at most
 * once, with a short timeout and a null fallback so a slow/failed API
 * never blocks or breaks the chat.
 */

const BASE = "https://api.freeastroapi.com/api/v2/vedic/panchang";
const TIMEOUT_MS = 5_000;

export interface DrikPanchang {
  date: string;
  sunrise?: string;
  sunset?: string;
  rahuKalam?: { start: string; end: string };
  tithi?: { number: number; name: string; paksha?: string; endsAt?: string };
  nakshatra?: { number: number; name: string; pada?: number; lord?: string };
  yoga?: { number: number; name: string };
  karana?: { number: number; name: string };
  lunarMonth?: { name: string; vikramSamvat?: number };
}

export function drikPanchangConfigured(): boolean {
  return Boolean(process.env.DRIKPANCHANG_API_KEY);
}

const MUHURAT_INTENT =
  /(muhurat|muhurt|shubh|auspicious|rahu kalam|rahu kaal|good (time|day)|best time|lucky time|start business|start new|shaadi|wedding|गृहप्रवेश|मुहूर्त|शुभ|राहु काल|अच्छा समय|नया काम)/i;

/** Whether a panchang-topic question actually needs the API (timing windows). */
export function isMuhuratIntent(question: string): boolean {
  return MUHURAT_INTENT.test(question);
}

const cache = new Map<string, DrikPanchang | null>();

function cacheKey(date: string, tz: string, lat: number, lng: number): string {
  return `${date}|${tz}|${Math.round(lat * 100)}|${Math.round(lng * 100)}`;
}

/**
 * Fetch the daily panchang for a local date. Returns null on any failure —
 * callers fall back to the free offline computation.
 */
export async function fetchDrikPanchang(params: {
  instant: Date;
  tz: string;
  lat: number;
  lng: number;
}): Promise<DrikPanchang | null> {
  const key = process.env.DRIKPANCHANG_API_KEY;
  if (!key) return null;

  const { instant, tz, lat, lng } = params;
  const offset = getUtcOffsetMinutes(instant, tz);
  const local = new Date(instant.getTime() + offset * 60_000);
  const date = local.toISOString().slice(0, 10);

  const ck = cacheKey(date, tz, lat, lng);
  if (cache.has(ck)) return cache.get(ck) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        year: local.getUTCFullYear(),
        month: local.getUTCMonth() + 1,
        day: local.getUTCDate(),
        hour: local.getUTCHours(),
        minute: local.getUTCMinutes(),
        lat,
        lng,
        tz_str: tz,
        ayanamsha: "lahiri",
        house_system: "whole_sign",
        node_type: "mean",
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`drikpanchang ${res.status}`);

    const body = (await res.json()) as {
      date?: string;
      sunrise?: string;
      sunset?: string;
      lunar_month?: { name?: string; vikram_samvat?: number };
      tithi?: { number?: number; name?: string; paksha?: string; ends_at?: string };
      nakshatra?: { number?: number; name?: string; pada?: number; lord?: string };
      yoga?: { number?: number; name?: string };
      rahu_kalam?: { start?: string; end?: string };
      request_time_panchang?: {
        tithi?: { number?: number; name?: string; paksha?: string };
        nakshatra?: { number?: number; name?: string; pada?: number; lord?: string };
        yoga?: { number?: number; name?: string };
        karana?: { number?: number; name?: string };
      };
    };

    const rt = body.request_time_panchang;
    const panchang: DrikPanchang = {
      date: body.date ?? date,
      sunrise: body.sunrise,
      sunset: body.sunset,
      rahuKalam: body.rahu_kalam?.start
        ? { start: body.rahu_kalam.start, end: body.rahu_kalam.end ?? "" }
        : undefined,
      tithi: rt?.tithi?.name
        ? { number: rt.tithi.number ?? 0, name: rt.tithi.name, paksha: rt.tithi.paksha }
        : undefined,
      nakshatra: rt?.nakshatra?.name
        ? { number: rt.nakshatra.number ?? 0, name: rt.nakshatra.name, pada: rt.nakshatra.pada, lord: rt.nakshatra.lord }
        : undefined,
      yoga: rt?.yoga?.name
        ? { number: rt.yoga.number ?? 0, name: rt.yoga.name }
        : undefined,
      karana: rt?.karana?.name
        ? { number: rt.karana.number ?? 0, name: rt.karana.name }
        : undefined,
      lunarMonth: body.lunar_month?.name
        ? { name: body.lunar_month.name, vikramSamvat: body.lunar_month.vikram_samvat }
        : undefined,
    };

    cache.set(ck, panchang);
    return panchang;
  } catch {
    cache.set(ck, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Compact prompt-ready summary of the API panchang. */
export function formatDrikPanchang(p: DrikPanchang): string {
  const parts: string[] = [];
  if (p.lunarMonth) {
    parts.push(
      `Lunar month ${p.lunarMonth.name}${
        p.lunarMonth.vikramSamvat ? `, Vikram Samvat ${p.lunarMonth.vikramSamvat}` : ""
      }`
    );
  }
  if (p.sunrise || p.sunset) parts.push(`Sunrise ${p.sunrise ?? "-"} · Sunset ${p.sunset ?? "-"}`);
  if (p.rahuKalam) parts.push(`Rahu Kalam ${p.rahuKalam.start}–${p.rahuKalam.end}`);
  if (p.tithi) parts.push(`Tithi ${p.tithi.name}${p.tithi.paksha ? ` (${p.tithi.paksha})` : ""}`);
  if (p.nakshatra) parts.push(`Nakshatra ${p.nakshatra.name}`);
  if (p.yoga) parts.push(`Yoga ${p.yoga.name}`);
  if (p.karana) parts.push(`Karana ${p.karana.name}`);
  return parts.join(" · ");
}
