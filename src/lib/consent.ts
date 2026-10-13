/**
 * Cookie / tracking consent.
 *
 * The site loads Meta Pixel (browser + server-side CAPI), Microsoft Clarity and
 * HubSpot. All three set cookies, so none of them may run before the visitor
 * has agreed. This module owns that decision.
 *
 * Two rules shape the design:
 *
 *  1. DENIED IS THE DEFAULT. Until someone chooses, only `necessary` runs.
 *     Nothing is loaded "and then cleaned up" — data that was never sent
 *     cannot be unsent, so the trackers are simply not mounted.
 *  2. SERVER-SIDE TRACKING COUNTS. Meta's Conversions API fires from the
 *     payment webhook, where there is no browser to ask. The choice is mirrored
 *     to a cookie so route handlers can honour it too — otherwise a visitor who
 *     declined advertising would still be reported to Meta after purchase.
 *
 * The cookie is read only by route handlers (which are dynamic by nature), so
 * consent never forces pages out of static prerendering.
 */
export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentState {
  version: number;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = "jyotish_consent_v1";
/** Readable by the payment webhook. Not HttpOnly — the UI reads it too. */
export const CONSENT_COOKIE = "jyotish_consent_v1";

export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 180; // 180 days

/**
 * Categories a visitor can choose. `necessary` is deliberately absent: it
 * covers the chat, auth and payment itself, which cannot be made optional
 * without breaking the product.
 */
export const CHOOSABLE_CATEGORIES: readonly ConsentCategory[] = ["analytics", "marketing"];

export function allGranted(): ConsentState {
  return {
    version: CONSENT_VERSION,
    analytics: true,
    marketing: true,
    decidedAt: new Date().toISOString(),
  };
}

export function allRefused(): ConsentState {
  return {
    version: CONSENT_VERSION,
    analytics: false,
    marketing: false,
    decidedAt: new Date().toISOString(),
  };
}

function isConsentState(value: unknown): value is ConsentState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ConsentState>;
  return (
    typeof v.analytics === "boolean" &&
    typeof v.marketing === "boolean" &&
    typeof v.decidedAt === "string"
  );
}

/**
 * Returns the stored choice, or null when nothing has been decided yet.
 *
 * A stored record from an older consent version is treated as no decision, so
 * the banner reappears when the categories change rather than carrying stale
 * consent forward.
 */
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isConsentState(parsed)) return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persists the choice and mirrors it to a cookie for server-side reads. */
export function writeConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    // SameSite=Lax so the webhook's cross-site POST still carries it, and
    // Secure in production. No HttpOnly: the preferences UI reads it.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}` +
      `; Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax${secure}`;
  } catch {
    // Private browsing or a full quota. Consent still applies for this page
    // view because the trackers are mounted from React state, not from here.
  }
}

/** Clears the stored choice so the banner is shown again. */
export function clearConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * The stored record as a raw string, for `useSyncExternalStore`.
 *
 * `getSnapshot` must return a referentially stable value or React loops
 * forever, and `readConsent()` builds a fresh object every call — so the store
 * reads the raw string and parses in render instead.
 */
export function readConsentRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Parses a raw snapshot. Server snapshot is always null (nothing stored yet). */
export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isConsentState(parsed)) return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Fires when the stored choice changes, including from another tab. */
export function notifyConsentChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT_NAME));
}

/**
 * Subscribes to consent changes. Returns the raw snapshot for
 * `useSyncExternalStore`, which is stable and cheap.
 */
export function subscribeToConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_CHANGE_EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const CONSENT_CHANGE_EVENT_NAME = "jyotish:consent-change";

/** Server-side read, for route handlers that send data to third parties. */
export function consentFromCookie(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!isConsentState(parsed)) return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}