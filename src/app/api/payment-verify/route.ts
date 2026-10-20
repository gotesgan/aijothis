import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { sendCapiPurchase } from "@/lib/meta-capi";
import { fromMinorUnits, isCurrency } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-side checkout success → verifies the Razorpay signature,
 * marks the order as paid, then grants the pack (sets paid20_at).
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
    // Every write below is scoped to THIS device and to orders still awaiting
    // payment.
    //
    // The signature proves the order/payment pair is genuine, but it says
    // nothing about WHO is presenting it. Without these scopes a buyer could
    // replay their own valid `{order_id, payment_id, signature}` with an
    // arbitrary `x-device-id` and mark somebody else's order paid — and, with
    // no status guard, could do it repeatedly to an order already settled.
    //
    // `.eq("status","created")` also makes the whole route idempotent: a replay
    // matches zero rows rather than rewriting a paid order.
    let orderUpdated = false;
    try {
      const { data: updated } = await admin
        .from("orders")
        .update({
          status: "paid",
          payment_id: razorpay_payment_id,
          signature: razorpay_signature,
          verified_at: new Date().toISOString(),
        })
        .eq("order_id", razorpay_order_id)
        .eq("device_id", deviceId)
        .eq("status", "created")
        .select("id");
      orderUpdated = (updated?.length ?? 0) > 0;
    } catch (err) {
      console.warn("[supabase] order verify skipped:", (err as Error).message);
    }

    // Grant only what we actually just settled. A replay that matched no rows
    // must not write the "has paid" marker onto a device it never paid for.
    if (orderUpdated) {
      const { error } = await admin
        .from("profiles")
        .update({ paid20_at: new Date().toISOString() })
        .eq("device_id", deviceId);
      if (error) console.warn("[supabase] verify grant failed:", error.message);

      // Meta Conversions API: settle the Purchase on the path the browser
      // always takes, so a missed or disabled webhook delivery can no longer
      // lose the conversion. `event_id` is the order id — the same value the
      // webhook and the browser Pixel send — so Meta dedupes them into one.
      //
      // Only on the transition to paid (`orderUpdated`): a replay matches no
      // rows and must not re-report an old conversion.
      try {
        const { data: order } = await admin
          .from("orders")
          .select("amount_paise, currency, client_ip, client_ua")
          .eq("order_id", razorpay_order_id)
          .maybeSingle();
        const currency = isCurrency(order?.currency) ? order.currency : "INR";
        if (typeof order?.amount_paise === "number") {
          const referer = request.headers.get("referer") ?? undefined;
          await sendCapiPurchase({
            value: fromMinorUnits(order.amount_paise, currency),
            currency,
            eventId: razorpay_order_id,
            clientIp:
              order.client_ip ??
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
              undefined,
            ua: order.client_ua ?? request.headers.get("user-agent") ?? undefined,
            eventSourceUrl:
              referer && referer.startsWith("http") ? referer : undefined,
          });
        }
      } catch (err) {
        console.warn("[capi] payment-verify send skipped:", (err as Error).message);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
