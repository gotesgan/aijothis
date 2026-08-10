/**
 * Sachet A/B test — deterministic variant assignment.
 *
 * A user's variant is a pure function of their device_id (stable across
 * visits, recomputable at analysis time from the orders table — no extra
 * tracking needed). This lets us measure the ₹5 sachet against control by
 * classifying every payer's device_id into a variant.
 *
 * Variant "sachet": first-time buyers see the ₹5/3q trial pack (pre-selected).
 * Variant "control": first-time buyers see the standard packs (no ₹5).
 *
 * The share of traffic in the sachet arm is tunable via env:
 *   NEXT_PUBLIC_SACHET_TEST_RATE=0.33   (default 0.5 — half of users)
 *
 * 0 disables the experiment entirely (everyone is control); 1 shows it to
 * everyone.
 */

const RATE = Number(process.env.NEXT_PUBLIC_SACHET_TEST_RATE ?? 0.5);

export type PaywallVariant = "sachet" | "control";

/** FNV-1a-ish hash of the device id → 0..1. Deterministic per device. */
function deviceHash(deviceId: string): number {
  let h = 2166136261;
  for (let i = 0; i < deviceId.length; i++) {
    h ^= deviceId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Which paywall variant this device gets. */
export function getPaywallVariant(deviceId: string): PaywallVariant {
  if (!RATE || RATE <= 0) return "control";
  return deviceHash(deviceId) < RATE ? "sachet" : "control";
}

/** True when the sachet experiment is running at all. */
export function sachetExperimentEnabled(): boolean {
  return RATE > 0;
}
