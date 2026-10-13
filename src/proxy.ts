import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { REGION_COOKIE, resolveRegion } from "@/lib/geo";
import { signRegionCookie, verifyRegionCookie } from "@/lib/region-signing";

const handleIntl = createMiddleware(routing);

/**
 * Pins the visitor's pricing region on their first page load.
 *
 * Two layers, because they stop different things:
 *  - HttpOnly blocks same-origin JS from rewriting it.
 *  - The HMAC signature blocks curl, devtools edits and hostile proxies.
 * Either alone is defeatable; together the cookie is an assertion we issued.
 *
 * Pinning it also means the price a visitor was shown is the price they are
 * charged — a traveller or VPN user is never repriced at the payment step.
 *
 * Written only when absent or unverifiable, so the first resolution wins and
 * stays sticky. An unsigned/tampered cookie is silently replaced rather than
 * honoured, and its own value is never trusted as the region.
 */
export default function proxy(request: NextRequest) {
  const response = handleIntl(request);

  const existing = request.cookies.get(REGION_COOKIE)?.value;
  if (!verifyRegionCookie(existing)) {
    const region = resolveRegion(request.headers.get("x-vercel-ip-country"), null);
    response.cookies.set({
      name: REGION_COOKIE,
      value: signRegionCookie(region),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  // Skip API routes, the admin control center, Next internals and static files
  matcher: ["/((?!api|admin|_next|.*\\..*).*)"],
};