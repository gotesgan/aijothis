import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { PAYWALL_DISMISSALS_FOR_BONUS } from "@/lib/pricing";

/**
 * Loyalty-bonus entitlement: server-authoritative by design.
 *
 * The dismissal counter is an ECONOMIC decision (we give away ~10 questions per
 * earned bonus), so it must not be client-readable state — a localStorage
 * counter can be set to 3 with one devtools line and the bonus is free forever.
 *
 * Identity spans google-linked devices, mirroring resolvePricingForDevice(): a
 * customer who returns on a new phone is the same person and keeps their
 * status. Dismissals are aggregated with MAX, not SUM, so three devices each
 * dismissed once still counts as earned rather than letting one person inflate
 * the counter by re-opening tabs.
 *
 * Every failure path returns `earned: false`. Withholding a bonus costs
 * goodwill; granting one we did not earn costs margin. (Note this is the
 * OPPOSITE failure bias to the quota gate, which fails OPEN because locking out
 * a paying customer is the worse outcome.)
 */
export interface BonusEntitlement {
  /** True when the bonus applies to this person's next order. */
  earned: boolean;
  /** Highest dismissal count across the person's linked devices. */
  dismissals: number;
  dismissalsToBonus: number;
}

const NOT_EARNED = {
  earned: false,
  dismissals: 0,
  dismissalsToBonus: PAYWALL_DISMISSALS_FOR_BONUS,
};

export async function resolveBonusForDevice(deviceId: string): Promise<BonusEntitlement> {
  const admin = getSupabaseAdmin();
  if (!admin) return NOT_EARNED;

  try {
    // Reuse the same identity resolution as pricing: the person's google_sub
    // device set. A failure there degrades to this device alone.
    const { deviceIds } = await resolveLinkedDevices(admin, deviceId);

    const { data, error } = await admin
      .from("profiles")
      .select("paywall_dismissals, bonus_earned_at, bonus_consumed_at")
      .in("device_id", deviceIds);
    if (error || !data || data.length === 0) return NOT_EARNED;

    const dismissals = data.reduce(
      (max, row) => Math.max(max, Number(row.paywall_dismissals) || 0),
      0
    );
    // One-time: once any linked device has spent the bonus, it is gone for the
    // whole person, not just for the device that used it.
    const consumed = data.some((row) => !!row.bonus_consumed_at);

    return {
      earned: dismissals >= PAYWALL_DISMISSALS_FOR_BONUS && !consumed,
      dismissals,
      dismissalsToBonus: PAYWALL_DISMISSALS_FOR_BONUS,
    };
  } catch (err) {
    console.warn("[bonus] entitlement lookup failed:", (err as Error).message);
    return NOT_EARNED;
  }
}

/**
 * Records one paywall dismissal and returns the resulting entitlement.
 *
 * Increments on this device's row (creating it if the person never persisted a
 * profile) and stamps `bonus_earned_at` the first time the threshold is crossed,
 * for analytics. Entitlement itself is derived from the counter, so a missed
 * stamp cannot deny a bonus that was genuinely earned.
 */
export async function recordPaywallDismissal(deviceId: string): Promise<BonusEntitlement> {
  const admin = getSupabaseAdmin();
  if (!admin) return NOT_EARNED;

  try {
    const { data: existing } = await admin
      .from("profiles")
      .select("device_id, paywall_dismissals")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!existing) {
      // No profile yet (user hit the paywall before persisting anything).
      // The unique(device_id) index makes this a benign race.
      const { error } = await admin.from("profiles").insert({
        device_id: deviceId,
        paywall_dismissals: 1,
      });
      if (error) {
        console.warn("[bonus] dismissal record failed:", error.message);
        return NOT_EARNED;
      }
    } else {
      const next = (Number(existing.paywall_dismissals) || 0) + 1;
      await admin
        .from("profiles")
        .update({
          paywall_dismissals: next,
          // Analytics only; set once, on the crossing.
          ...(next === PAYWALL_DISMISSALS_FOR_BONUS ? { bonus_earned_at: new Date().toISOString() } : {}),
        })
        .eq("device_id", deviceId);
    }

    return await resolveBonusForDevice(deviceId);
  } catch (err) {
    console.warn("[bonus] dismissal failed:", (err as Error).message);
    return NOT_EARNED;
  }
}

/**
 * Consumes the one-time bonus after a fulfilled order. Called from the webhook
 * (and the simulated path) so a second purchase does not also carry the bonus.
 * Best-effort: failing to stamp this would re-grant the bonus once, which is a
 * far smaller loss than blocking a paid fulfilment.
 */
export async function consumeBonus(deviceId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin
      .from("profiles")
      .update({ bonus_consumed_at: new Date().toISOString() })
      .eq("device_id", deviceId)
      .is("bonus_consumed_at", null);
  } catch (err) {
    console.warn("[bonus] consume failed:", (err as Error).message);
  }
}

/** Shared identity resolution: this device plus every google-linked device. */
async function resolveLinkedDevices(
  admin: ReturnType<typeof getSupabaseAdmin> & object,
  deviceId: string
): Promise<{ deviceIds: string[] }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("google_sub")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (!profile?.google_sub) return { deviceIds: [deviceId] };

  const { data: linked } = await admin
    .from("profiles")
    .select("device_id")
    .eq("google_sub", profile.google_sub);
  return { deviceIds: [...new Set([deviceId, ...(linked ?? []).map((r) => r.device_id)])] };
}