/**
 * Meta Conversions API (CAPI) — server-side Purchase events.
 *
 * Browser pixels are unreliable (ad-blockers, in-app browsers, lost tabs).
 * Sending the same Purchase from the server — with the SAME `event_id` that
 * the browser fired — lets Meta deduplicate and trust the conversion. This
 * fixes the "low quality" delivery signal: Meta sees the real, verified
 * payment instead of a guess.
 *
 * Requires (Vercel / .env.local):
 *   META_PIXEL_ID    — the Meta Pixel ID (same as the browser pixel)
 *   META_CAPI_TOKEN  — a system-user or app access token with
 *                      `ads_management` / pixel "Edit" permission
 *
 * Non-fatal: if Meta is unreachable or misconfigured, payment flows never
 * break — CAPI is fire-and-forget.
 */

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

export function capiConfigured(): boolean {
  return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

/**
 * Sends a Purchase event to the Conversions API.
 *
 * @param params.value     amount in INR (decimal, e.g. 20)
 * @param params.eventId   the SAME event_id the browser Pixel fired, so Meta
 *                         dedupes browser + server into one conversion.
 * @param params.eventTime Unix seconds (defaults to now).
 * @param params.clientIp  Optional client IP for better attribution.
 * @param params.ua        Optional client user agent for better attribution.
 */
export async function sendCapiPurchase(params: {
  value: number;
  eventId: string;
  eventTime?: number;
  clientIp?: string;
  ua?: string;
}): Promise<{ ok: boolean }> {
  if (!capiConfigured()) return { ok: false };

  // Meta requires customer-information params for `website` events. At minimum
  // IP + user-agent must be present or the event is rejected (error_subcode
  // 2804050). The Razorpay webhook passes the client's real IP/UA from the
  // payment request; fall back to the server's own when unavailable.
  const userData: Record<string, unknown> = {
    client_ip_address: params.clientIp ?? "0.0.0.0",
    client_user_agent: params.ua ?? "Unknown",
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: ACCESS_TOKEN,
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor(
                (params.eventTime ?? Date.now()) / 1000
              ),
              event_id: params.eventId,
              action_source: "website",
              user_data: userData,
              custom_data: {
                value: params.value,
                currency: "INR",
              },
            },
          ],
        }),
      }
    );
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string; error_user_msg?: string };
    } | null;
    if (!res.ok) {
      console.warn(
        "[capi] Meta event rejected:",
        json?.error?.error_user_msg ?? json?.error?.message ?? res.status
      );
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[capi] send failed:", (err as Error).message);
    return { ok: false };
  }
}
