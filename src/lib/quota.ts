import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { resolvePricingForDevice } from "@/lib/pricing-server";

/**
 * The free allowance, in questions. This constant is the authority: the client
 * mirrors it in `arya-chat.tsx` only so it can show the paywall without a
 * round-trip. Changing the limit here is what actually changes the limit.
 */
export const FREE_LIMIT = 1;

/**
 * The instant server-side question metering began.
 *
 * Questions persisted BEFORE this were asked while the app had NO server quota
 * — they were free by design. Counting them against a user's allowance is the
 * bug that locked paying customers out: a long-standing user had ~1,000
 * questions on record and ~260 purchased credits, so no matter how many packs
 * they bought, `used < FREE_LIMIT + credits` could never become true again and
 * a verified payment granted nothing. Metering may only charge for questions
 * asked while metering was actually on.
 *
 * Overridable so the baseline can be corrected without a deploy.
 */
export const METERING_STARTED_AT =
  process.env.QUOTA_METERING_STARTED_AT ?? "2026-10-14T00:00:00+05:30";

/**
 * Historical pack ids that predate the `pack_questions` column. Their orders
 * were captured with a NULL quantity, so they contributed ZERO credits — the
 * same "paid but locked out" failure for that plan. The pre-cutoff menu was
 * ₹1 per question, so the id names the quantity directly.
 */
const LEGACY_PACK_QUESTIONS: Record<string, number> = {
  p10: 10,
  p20: 20,
  p30: 30,
  p60: 60,
};

/**
 * Questions a paid order is worth. Prefers the recorded `pack_questions`;
 * falls back to the historical pack id when that column is NULL, so a paid
 * order can never silently be worth nothing.
 */
export function orderQuestions(order: {
  pack_id?: string | null;
  pack_questions?: number | string | null;
}): number {
  const stored = Number(order.pack_questions);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const legacy = order.pack_id ? LEGACY_PACK_QUESTIONS[order.pack_id] : undefined;
  return legacy ?? 0;
}

export interface QuotaResult {
  allowed: boolean;
  /** Metered questions already asked (on/after METERING_STARTED_AT). */
  used: number;
  /** FREE_LIMIT + questions bought on paid orders. */
  allowance: number;
}

/** The state the quota decision is made from, for reuse by /api/orders. */
export interface Entitlement {
  /** Questions asked under metering. */
  used: number;
  /** Questions bought, summed across every linked device. */
  credits: number;
  /** FREE_LIMIT + credits. */
  allowance: number;
}

/**
 * Metered usage and purchased credits for a set of linked devices.
 *
 * This is the ONE place the numbers are computed, so the server's gate and the
 * numbers the client reconciles against can never disagree.
 */
export async function entitlementForDevices(
  deviceIds: string[]
): Promise<Entitlement> {
  const admin = getSupabaseAdmin();
  if (!admin) return { used: 0, credits: 0, allowance: FREE_LIMIT };

  // Purchased credits, across every linked device.
  const { data: orders } = await admin
    .from("orders")
    .select("pack_id, pack_questions")
    .in("device_id", deviceIds)
    .eq("status", "paid");
  const credits = (orders ?? []).reduce((sum, o) => sum + orderQuestions(o), 0);

  // Questions already asked, counted from persisted messages rather than a
  // client counter. `messages` has no device_id, so this walks
  // messages -> chats -> profiles. Only questions asked while metering was on
  // count — see METERING_STARTED_AT.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .in("device_id", deviceIds);
  const profileIds = (profiles ?? []).map((p) => p.id);

  let used = 0;
  if (profileIds.length > 0) {
    const { data: chats } = await admin
      .from("chats")
      .select("id")
      .in("profile_id", profileIds);
    const chatIds = (chats ?? []).map((c) => c.id);
    if (chatIds.length > 0) {
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("role", "user")
        .gte("created_at", METERING_STARTED_AT)
        .in("chat_id", chatIds);
      used = count ?? 0;
    }
  }

  return { used, credits, allowance: FREE_LIMIT + credits };
}

/**
 * Server-authoritative quota check.
 *
 * The browser used to be the only thing enforcing the free limit, which meant
 * clearing localStorage reset it. The truth is already in the database — user
 * messages live in `messages`, purchased credits live in `orders` — so the
 * check reads from there instead of trusting a client-supplied number.
 *
 * Counts across ALL of a person's linked devices (resolved via google_sub), so
 * the limit cannot be evaded by switching phones.
 *
 * A verified payment ALWAYS grants access: credits are added to the allowance
 * and only metered questions consume it, so a payer is never gated by usage
 * that happened before the quota existed.
 *
 * FAILS OPEN. Any missing configuration or query error allows the question,
 * because the failure mode we care about is a paying customer being locked out
 * of a question they already bought, not a free question slipping through. Set
 * `SERVER_QUOTA_ENABLED=0` to disable without a deploy.
 */
export async function checkQuota(deviceId: string): Promise<QuotaResult> {
  const allow = { allowed: true, used: 0, allowance: FREE_LIMIT };
  if (process.env.SERVER_QUOTA_ENABLED === "0") return allow;
  // No identity to charge against — nothing to enforce.
  if (!deviceId || deviceId === "-") return allow;
  const admin = getSupabaseAdmin();
  if (!admin) return allow;

  try {
    const { deviceIds } = await resolvePricingForDevice(deviceId);
    const { used, allowance } = await entitlementForDevices(deviceIds);
    return { allowed: used < allowance, used, allowance };
  } catch (err) {
    console.warn("[quota] check failed, allowing:", (err as Error).message);
    return allow;
  }
}

/** Status the client checks to know it should open the paywall. */
export const QUOTA_EXHAUSTED = 402;
