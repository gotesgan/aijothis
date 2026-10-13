import "server-only";

import { cookies, headers } from "next/headers";

import { REGION_COOKIE, REGION_CURRENCY, resolveRegion, type Region } from "@/lib/geo";
import { verifyRegionCookie } from "@/lib/region-signing";
import type { Currency } from "@/lib/money";

/** Vercel's edge country header. Absent on local dev and self-hosted targets. */
const COUNTRY_HEADER = "x-vercel-ip-country";

/**
 * Resolves the pricing region for an incoming request. Used by the checkout
 * route, which is where the price actually becomes money — so this must never
 * trust a value the browser can assert about itself.
 */
export function resolveRegionFromRequest(request: Request): Region {
  // A raw Request has no cookie helper, so read the header directly.
  //
  // The value is NOT percent-decoded before verification: `decodeURIComponent`
  // throws a URIError on malformed input like `%`, and this runs outside any
  // try/catch — one crafted Cookie header would 500 the checkout. The signed
  // value is plain `IN.<base64url>` and needs no decoding.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REGION_COOKIE}=`));
  const raw = match ? match.slice(REGION_COOKIE.length + 1).trim() : null;

  return resolveRegion(
    request.headers.get(COUNTRY_HEADER),
    verifyRegionCookie(raw)
  );
}

/** Same rule, for Server Components that need the region at render time. */
export async function resolveRegionFromServer(): Promise<Region> {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return resolveRegion(
    headerList.get(COUNTRY_HEADER),
    verifyRegionCookie(cookieStore.get(REGION_COOKIE)?.value)
  );
}

export async function resolveCurrencyFromServer(): Promise<Currency> {
  return REGION_CURRENCY[await resolveRegionFromServer()];
}