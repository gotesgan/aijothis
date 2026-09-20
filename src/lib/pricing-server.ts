import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { cohortForFirstSeen, type PricingCohort } from "@/lib/pricing";

/**
 * Resolves a person’s pricing cohort. Google-linked devices share the earliest
 * profile creation timestamp, so an existing buyer does not become a new user
 * merely by returning on another device.
 */
export async function resolvePricingForDevice(deviceId: string): Promise<{
  cohort: PricingCohort;
  deviceIds: string[];
}> {
  const admin = getSupabaseAdmin();
  if (!admin) return { cohort: "current", deviceIds: [deviceId] };

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("google_sub, created_at")
      .eq("device_id", deviceId)
      .maybeSingle();

    let linked: { device_id: string; created_at: string | null }[] = [];
    if (profile?.google_sub) {
      const { data } = await admin
        .from("profiles")
        .select("device_id, created_at")
        .eq("google_sub", profile.google_sub);
      linked = data ?? [];
    }

    const deviceIds = [...new Set([deviceId, ...linked.map((item) => item.device_id)])];
    const createdAt = [profile?.created_at, ...linked.map((item) => item.created_at)]
      .filter((value): value is string => !!value && Number.isFinite(new Date(value).getTime()))
      .sort()[0];

    return { cohort: cohortForFirstSeen(createdAt), deviceIds };
  } catch (err) {
    console.warn("[pricing] cohort lookup failed:", (err as Error).message);
    // A failed lookup must never accidentally grant an old-user price.
    return { cohort: "current", deviceIds: [deviceId] };
  }
}
