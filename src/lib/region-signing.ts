import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { isRegion, type Region } from "@/lib/geo";

/**
 * Signs the region cookie so it cannot be forged.
 *
 * HttpOnly alone only blocks same-origin JS. It does NOT stop
 * `curl -H 'Cookie: jyotish_region_v1=IN'`, a devtools edit, or a hostile
 * proxy — and downgrading your own region is a ~76% revenue leak ($4.99 → ₹99)
 * on exactly the foreign traffic this exists to monetise. Signing turns the
 * cookie into an assertion we issued rather than one the visitor wrote.
 *
 * The secret is derived from RAZORPAY_KEY_SECRET rather than a new env var, so
 * turning on foreign pricing needs no additional secret to provision. Override
 * with PRICING_GEO_SECRET if you would rather rotate this independently.
 *
 * Server-only: this pulls in node:crypto, which must never reach the client
 * bundle. The pure half of the region rule lives in @/lib/geo.
 */
const SIGNING_SECRET =
  process.env.PRICING_GEO_SECRET ?? process.env.RAZORPAY_KEY_SECRET ?? "";

function regionSignature(region: string): string {
  return createHmac("sha256", SIGNING_SECRET)
    .update(region)
    .digest("base64url")
    .slice(0, 16);
}

/** Wire format for the Set-Cookie value: `<region>.<signature>`. */
export function signRegionCookie(region: Region): string {
  return `${region}.${regionSignature(region)}`;
}

/**
 * Verifies a signed cookie value, returning the region or null. Any tampering,
 * truncation or absent secret returns null so the caller falls through to the
 * edge country header.
 *
 * An unconfigured secret fails CLOSED (null, not the raw value): a deployment
 * that somehow lost its secret must not start honouring unsigned cookies.
 */
export function verifyRegionCookie(raw: string | null | undefined): Region | null {
  if (!raw || !SIGNING_SECRET) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const region = raw.slice(0, separator);
  if (!isRegion(region)) return null;
  const provided = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(regionSignature(region));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? region : null;
}