import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolvePricingForDevice } from "@/lib/pricing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Who am I, and do I already have a chart?" — the resume endpoint.
 *
 * The birth details a returning user is being asked to retype are ALREADY on
 * their profile row: /api/kundli persists birth_date/birth_time/birth_place/
 * lat/lng/timezone and the full kundli_json. Nothing was reading them back, so
 * the app behaved as if it had never met the user. This closes that loop.
 *
 * Identity spans google-linked devices (same helper checkout uses), so someone
 * who signed in on one phone and returns on another is still recognised — and
 * their chart travels with them.
 *
 * Trust model: scoped by the `x-device-id` header, exactly like /api/orders and
 * /api/history. That is a device id, not an authentication token, so this is
 * consistent with the rest of the codebase while real auth is still deferred —
 * see supabase/deferred-migrations/0002_auth_rls.sql. It must not grow into a
 * profile-lookup-by-arbitrary-key endpoint.
 */
export async function GET(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const empty = {
    hasKundli: false,
    signedUp: false,
    name: null as string | null,
    birth: null as {
      date: string;
      time: string;
      place: string;
      lat: number;
      lng: number;
      timezone: string;
    } | null,
    kundli: null as unknown,
  };

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json(empty);

  try {
    const { deviceIds } = await resolvePricingForDevice(deviceId);

    // Most recent chart across the person's linked devices wins: a user who
    // recomputed their Kundli on a second device should get that one back.
    const { data: chart, error } = await admin
      .from("profiles")
      .select(
        "kundli_json, name, birth_date, birth_time, birth_place, lat, lng, timezone, created_at"
      )
      .in("device_id", deviceIds)
      .not("kundli_json", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[me] chart lookup failed:", error.message);
      return NextResponse.json(empty);
    }

    // Signed-up is answered independently of the chart: someone who signed up
    // on a device that never saved a kundli must still not be shown the Google
    // gate again.
    const { data: signedUpRows } = await admin
      .from("profiles")
      .select("signed_up_at")
      .in("device_id", deviceIds);
    const signedUp = (signedUpRows ?? []).some((r) => !!r.signed_up_at);

    // Gender is a newer column than the rest, and its migration ships
    // separately. Read it on its own and tolerate the column not being there
    // yet: a failed select inside the chart query above would look exactly like
    // "this person has no chart", which would cost them their pre-filled
    // details and the returning-user redirect.
    let gender: string | null = null;
    const { data: genderRow } = await admin
      .from("profiles")
      .select("gender")
      .in("device_id", deviceIds)
      .not("gender", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (genderRow && typeof genderRow.gender === "string") {
      gender = genderRow.gender;
    }

    if (!chart?.kundli_json) {
      return NextResponse.json({ ...empty, signedUp });
    }

    const birth =
      chart.birth_date && chart.birth_time && chart.birth_place
        ? {
            date: chart.birth_date as string,
            time: chart.birth_time as string,
            place: chart.birth_place as string,
            lat: Number(chart.lat),
            lng: Number(chart.lng),
            timezone: (chart.timezone as string) || "Asia/Kolkata",
          }
        : null;

    return NextResponse.json({
      hasKundli: true,
      signedUp,
      // Lets the details form come back pre-filled rather than empty, so a
      // stale link or a fast chip-tap never asks them to retype anything.
      name: (chart.name as string) || null,
      gender,
      birth,
      kundli: chart.kundli_json,
    });
  } catch (err) {
    console.warn("[me] failed:", (err as Error).message);
    return NextResponse.json(empty);
  }
}