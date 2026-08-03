import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyPaymentSignature } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-side checkout success → verifies the Razorpay signature,
 * then grants the 20-question pack (sets paid20_at on the profile).
 */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  const body = await request.json().catch(() => null);
  if (!deviceId || !body) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (
    !verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("profiles")
      .update({ paid20_at: new Date().toISOString() })
      .eq("device_id", deviceId);
    if (error) console.warn("[supabase] verify grant failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
