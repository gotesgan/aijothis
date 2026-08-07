/**
 * Cloudflare Turnstile — server-side siteverify.
 *
 * Canonical call:
 *   POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 *   body: { secret: process.env.TURNSTILE_SECRET, response: <token>,
 *           remoteip: <client ip> }
 * The request is allowed through only when `success === true`.
 *
 * Open mode: when TURNSTILE_SECRET is not configured (local dev), siteverify
 * is skipped so development isn't blocked — production MUST set the secret.
 */

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    // Open mode (no secret configured) — log loudly so it's not missed in prod.
    console.warn("[turnstile] TURNSTILE_SECRET not set — siteverify skipped (open mode)");
    return true;
  }
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** Best-effort client IP from the standard reverse-proxy headers. */
export function clientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}
