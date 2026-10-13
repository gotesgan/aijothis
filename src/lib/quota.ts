import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { resolvePricingForDevice } from "@/lib/pricing-server";

/**
 * The free allowance, in questions. This constant is the authority: the client
 * mirrors it in `arya-chat.tsx` only so it can show the paywall without a
 * round-trip. Changing the limit here is what actually changes the limit.
 */
export const FREE_LIMIT = 5;

export interface QuotaResult {
  allowed: boolean;
  /** Questions already asked, counted from persisted messages. */
  used: number;
  /** FREE_LIMIT + questions bought on paid orders. */
  allowance: number;
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
 * FAILS OPEN. Any missing configuration or query error allows the question,
 * because the failure mode we care about is a paying customer being locked out
 * of a question they already bought, not a free question slipping through. Set
 * `SERVER_QUOTA_ENABLED=0` to disable without a deploy.
 */
export async function checkQuota(deviceId: string): Promise<QuotaResult> {
  if (process.env.SERVER_QUOTA_ENABLED === "0") {
    return { allowed: true, used: 0, allowance: FREE_LIMIT };
  }
  // No identity to charge against — nothing to enforce.
  if (!deviceId || deviceId === "-") {
    return { allowed: true, used: 0, allowance: FREE_LIMIT };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { allowed: true, used: 0, allowance: FREE_LIMIT };

  try {
    const { deviceIds } = await resolvePricingForDevice(deviceId);

    // Purchased credits, across every linked device.
    const { data: orders } = await admin
      .from("orders")
      .select("pack_questions")
      .in("device_id", deviceIds)
      .eq("status", "paid");
    const credits = (orders ?? []).reduce(
      (sum, o) => sum + (Number(o.pack_questions) || 0),
      0
    );

    // Questions already asked, counted from persisted messages rather than a
    // client counter. `messages` has no device_id, so this walks
    // messages -> chats -> profiles.
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
          .in("chat_id", chatIds);
        used = count ?? 0;
      }
    }

    const allowance = FREE_LIMIT + credits;
    return { allowed: used < allowance, used, allowance };
  } catch (err) {
    console.warn("[quota] check failed, allowing:", (err as Error).message);
    return { allowed: true, used: 0, allowance: FREE_LIMIT };
  }
}

/** Status the client checks to know it should open the paywall. */
export const QUOTA_EXHAUSTED = 402;