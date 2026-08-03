import type { KundliResult } from "./types";

export const KUNDLI_KEY = "jyotish_kundli_v1";
export const DEVICE_KEY = "jyotish_device_id_v1";

export function saveKundli(kundli: KundliResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KUNDLI_KEY, JSON.stringify(kundli));
}

export function loadKundli(): KundliResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KUNDLI_KEY);
    return raw ? (JSON.parse(raw) as KundliResult) : null;
  } catch {
    return null;
  }
}

export function clearKundli(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KUNDLI_KEY);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/* Daily JSON caches (keyed by date + locale). */

export function readDailyCache<T>(key: string, locale: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (
      c.date === new Date().toISOString().slice(0, 10) &&
      c.lang === locale &&
      c.data
    ) {
      return c.data as T;
    }
  } catch {
    // ignore stale cache
  }
  return null;
}

export function writeDailyCache(
  key: string,
  locale: string,
  data: unknown
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    key,
    JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      lang: locale,
      data,
    })
  );
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Stable per-browser chat id (one chat per device for now). */
export function getOrCreateChatId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "jyotish_chat_id_v1";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = newUuid();
    localStorage.setItem(KEY, id);
  }
  return id;
}
