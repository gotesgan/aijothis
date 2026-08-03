import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a Google signup for the experiment (device-keyed, no auth yet).
 * Idempotent — safe to call repeatedly.
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
      .update({ signed_up_at: new Date().toISOString() })
      .eq("device_id", deviceId);
    if (error) {
      console.warn("[supabase] signup record failed:", error.message);
    }
  }

  return NextResponse.json({ ok: true });
}
