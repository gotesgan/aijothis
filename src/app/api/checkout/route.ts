import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, razorpayConfigured, KEY_ID } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a Razorpay order for the chosen pack (or simulates without keys). */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  const body = await request.json().catch(() => null);
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const amountPaise = Number(body?.amountPaise ?? 1500);
  if (!Number.isInteger(amountPaise) || amountPaise < 1000 || amountPaise > 5000) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  // Real payment path.
  if (razorpayConfigured()) {
    try {
      const order = await createRazorpayOrder(deviceId, amountPaise);
      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: KEY_ID,
        simulated: false,
      });
    } catch (err) {
      console.error("razorpay order failed:", (err as Error).message);
      return NextResponse.json(
        { error: "order_failed", message: (err as Error).message },
        { status: 500 }
      );
    }
  }

  // Simulated path (experiment until keys are wired).
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("profiles")
      .update({ paid20_at: new Date().toISOString() })
      .eq("device_id", deviceId);
    if (error) console.warn("[supabase] checkout record failed:", error.message);
  }
  return NextResponse.json({ simulated: true, ok: true });
}
