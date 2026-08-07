import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature, getOrderReceipt } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — grants the pack when a payment is captured.
 * The order `receipt` field encodes the device id (set at order creation).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  // A failed payment attempt — mark the order `failed` so it is no longer
  // shown as a stale "pending resume" candidate. Mirrors Razorpay's
  // `attempted` status (our orders CHECK constraint allows created/paid/
  // simulated/failed).
  if (event?.event === "payment.failed") {
    const orderId = event?.payload?.payment?.entity?.order_id as string | undefined;
    if (orderId) {
      const admin = getSupabaseAdmin();
      if (admin) {
        try {
          await admin
            .from("orders")
            .update({ status: "failed" })
            .eq("order_id", orderId);
        } catch (err) {
          console.warn("[supabase] failed-payment webhook skipped:", (err as Error).message);
        }
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event?.event !== "payment.captured") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const orderId = event?.payload?.payment?.entity?.order_id as string | undefined;
  const paymentId = event?.payload?.payment?.entity?.id as string | undefined;
  const deviceId = orderId ? await getOrderReceipt(orderId) : null;

  if (deviceId) {
    const admin = getSupabaseAdmin();
    if (admin) {
      // Record the captured payment on the order row (non-fatal).
      try {
        await admin
          .from("orders")
          .update({
            status: "paid",
            payment_id: paymentId ?? null,
            verified_at: new Date().toISOString(),
          })
          .eq("order_id", orderId);
      } catch (err) {
        console.warn("[supabase] order webhook skipped:", (err as Error).message);
      }

      const { error } = await admin
        .from("profiles")
        .update({ paid20_at: new Date().toISOString() })
        .eq("device_id", deviceId);
      if (error) console.warn("[supabase] webhook grant failed:", error.message);
    }
  }

  return NextResponse.json({ received: true });
}
