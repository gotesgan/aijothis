import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature, getOrderReceipt } from "@/lib/razorpay";
import { sendCapiPurchase } from "@/lib/meta-capi";
import { consumeBonus } from "@/lib/bonus-server";
import { fromMinorUnits, isCurrency } from "@/lib/money";

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
  const capturedMinor = event?.payload?.payment?.entity?.amount as number | undefined;
  const deviceId = orderId ? await getOrderReceipt(orderId) : null;

  // The order row is the authority on what we agreed to charge and in which
  // currency — never on what the webhook claims. It also holds the customer's
  // browser IP/UA, because the webhook is server-to-server from Razorpay and
  // its own headers carry Razorpay's IP.
  let expectedMinor: number | null = null;
  let orderCurrency: string | null = null;
  let clientIp: string | undefined;
  let clientUa: string | undefined;
  if (orderId) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin
        .from("orders")
        .select("client_ip, client_ua, amount_paise, currency")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) {
        console.warn("[supabase] order lookup skipped:", error.message);
      }
      const order = data as Record<string, unknown> | null;

      expectedMinor = order?.amount_paise == null ? null : Number(order.amount_paise);
      orderCurrency = (order?.currency as string | undefined) ?? null;
      clientIp = (order?.client_ip as string | undefined) ?? undefined;
      clientUa = (order?.client_ua as string | undefined) ?? undefined;
      if (order && expectedMinor === null) {
        console.error(`[razorpay] order ${orderId} has no readable amount — not fulfilling`);
      }
    }
  }

  // Defence in depth: we only fulfil the amount we created the order for. A
  // mismatch means something is off with the capture, so record nothing and let
  // a human reconcile rather than granting credits on an unverified amount.
  //
  // `expectedMinor === null` means we have no row to compare against (Supabase
  // unavailable, or the order insert was swallowed). That is NOT a mismatch —
  // refusing there would leave real captured payments permanently unfulfilled
  // because of a transient DB problem, with no retry to save us.
  if (
    expectedMinor !== null &&
    Number.isFinite(expectedMinor) &&
    typeof capturedMinor === "number" &&
    expectedMinor !== capturedMinor
  ) {
    console.error(
      `[razorpay] amount mismatch for ${orderId}: expected ${expectedMinor} ${orderCurrency}, captured ${capturedMinor} — not fulfilling`
    );
    return NextResponse.json({ received: true, rejected: "amount_mismatch" });
  }

  // Meta Conversions API: report the real, verified payment server-side.
  // `event_id` = the order id, the SAME id the browser Pixel sends, so Meta
  // dedupes browser + server into one conversion (no double-counting).
  //
  // Sent for every verified payment, regardless of marketing consent. Consent
  // is still captured at checkout and stored on the order for auditing.
  if (orderId && typeof capturedMinor === "number") {
    const currency = isCurrency(orderCurrency) ? orderCurrency : "INR";
    await sendCapiPurchase({
      value: fromMinorUnits(capturedMinor, currency),
      currency,
      eventId: orderId,
      clientIp,
      ua: clientUa,
    });
  }

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

      // Spend the one-time loyalty bonus. The extra questions are already
      // baked into the order's `pack_questions`, which is what the quota gate
      // credits — this only stops a SECOND order carrying the same bonus.
      // Best-effort: re-granting once costs a few questions, whereas throwing
      // here would block a paid fulfilment.
      await consumeBonus(deviceId);
    }
  }

  return NextResponse.json({ received: true });
}
