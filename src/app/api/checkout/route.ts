import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, razorpayConfigured, KEY_ID } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACK_PRICE_PAISE = 1500; // ₹15 for 20 questions

/** Creates a Razorpay order (or simulates when keys aren't configured). */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  // Real payment path.
  if (razorpayConfigured()) {
    try {
      const order = await createRazorpayOrder(deviceId, PACK_PRICE_PAISE);
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
