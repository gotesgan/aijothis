import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a (simulated) purchase of the ₹15 / 20-question pack.
 * Swaps to a real Razorpay order + webhook when keys are wired.
 */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("profiles")
      .update({ paid20_at: new Date().toISOString() })
      .eq("device_id", deviceId);
    if (error) {
      console.warn("[supabase] checkout record failed:", error.message);
    }
  }

  return NextResponse.json({ ok: true });
}
