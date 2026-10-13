/**
 * Region detection for currency selection.
 *
 * Region is resolved SERVER-SIDE only, from the edge's country header, and then
 * pinned to a cookie. It is deliberately not client-supplied: the checkout
 * amount is server-owned, so anything the browser can assert about its own
 * region is a way to pick a cheaper price.
 *
 * Resolution order (highest priority first):
 *   1. `PRICING_GEO_ENABLED=0`  → kill switch, everyone is priced INR.
 *   2. `PRICING_REGION_OVERRIDE` → forced region, for local testing.
 *   3. The sticky region cookie   → the region we first showed prices for.
 *   4. `x-vercel-ip-country`      → the visitor's edge-detected country.
 *   5. India                     → default, so an unknown visitor never sees
 *                                  a price higher than today's.
 *
 * The cookie wins over the IP header on purpose. A traveller or a VPN user must
 * not be repriced at the payment step — the number they tapped has to be the
 * number they are charged.
 */
import type { Currency } from "@/lib/money";

export type Region = "IN" | "US" | "EU";

export const REGION_COOKIE = "jyotish_region_v1";

export const REGION_CURRENCY: Record<Region, Currency> = {
  IN: "INR",
  US: "USD",
  EU: "EUR",
};

export const CURRENCY_REGION: Record<Currency, Region> = {
  INR: "IN",
  USD: "US",
  EUR: "EU",
};

export function isRegion(value: unknown): value is Region {
  return value === "IN" || value === "US" || value === "EU";
}

/** India plus the neighbours that behave like the home market. */
const INR_COUNTRIES = new Set(["IN", "NP", "BD", "LK", "MM", "BT"]);

/**
 * Eurozone. Charging EUR to these cards is both the expected currency and the
 * lowest-friction choice for the issuer.
 */
const EUR_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SI", "ES", "SK",
]);

export const DEFAULT_REGION: Region = "IN";

/** Maps an ISO 3166-1 alpha-2 country code to a pricing region. */
export function regionForCountry(country: string | null | undefined): Region {
  const code = (country ?? "").trim().toUpperCase();
  if (!code) return DEFAULT_REGION;
  if (INR_COUNTRIES.has(code)) return "IN";
  if (EUR_COUNTRIES.has(code)) return "EU";
  // Everything else — including the UK, Switzerland and the Nordics — is
  // charged in USD. Their cards all bill USD natively, so this avoids the
  // issuer-conversion surprise and the decline risk of charging a European
  // currency outside the eurozone. Native GBP/CHF/SEK pricing is a follow-up.
  return "US";
}

/**
 * Parses a legacy unsigned region value. Kept for values written before the
 * cookie was signed; production callers must use `verifyRegionCookie` in
 * @/lib/region-signing instead, which will reject these.
 */
export function parseRegionCookie(raw: string | null | undefined): Region | null {
  if (!raw) return null;
  return isRegion(raw) ? raw : null;
}

/**
 * Kill switch. `PRICING_GEO_ENABLED=0` pins every visitor to INR without a
 * deploy — the safe move if foreign pricing misbehaves in production.
 */
export function geoPricingEnabled(): boolean {
  return process.env.PRICING_GEO_ENABLED !== "0";
}

/** `PRICING_REGION_OVERRIDE` forces a region locally. Never read on clients. */
export function regionOverride(): Region | null {
  const raw = process.env.PRICING_REGION_OVERRIDE?.trim();
  return isRegion(raw) ? raw : null;
}

/**
 * The single resolution rule, in the priority documented at the top of this
 * file. Pure so that @/lib/region-server (Node) and src/proxy.ts (edge) cannot
 * drift apart — a drift here would mean the price shown and the price charged
 * come from different rules.
 *
 * `verifiedCookieRegion` must ALREADY have passed signature verification (see
 * `verifyRegionCookie`). This function never parses raw cookie text, so there
 * is no path by which unverified visitor input reaches the pricing decision.
 */
export function resolveRegion(
  country: string | null | undefined,
  verifiedCookieRegion: Region | null
): Region {
  if (!geoPricingEnabled()) return DEFAULT_REGION;
  const override = regionOverride();
  if (override) return override;
  if (verifiedCookieRegion) return verifiedCookieRegion;
  return regionForCountry(country);
}