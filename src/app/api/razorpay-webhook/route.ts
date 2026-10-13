import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature, getOrderReceipt } from "@/lib/razorpay";
import { sendCapiPurchase } from "@/lib/meta-capi";
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
  let marketingConsent = false;
  // False when the marketing_consent column is not applied yet, so we know we
  // cannot tell whether consent was granted and must not silently drop events.
  let consentKnown = false;
  let clientIp: string | undefined;
  let clientUa: string | undefined;
  if (orderId) {
    const admin = getSupabaseAdmin();
    if (admin) {
      // Two-step so a missing migration column degrades instead of breaking
      // attribution. Postgres rejects a SELECT naming a column that does not
      // exist, which would otherwise return no row and lose the amount check,
      // the client IP/UA and the consent signal all at once.
      let order: Record<string, unknown> | null = null;
      const withConsent = await admin
        .from("orders")
        .select("client_ip, client_ua, amount_paise, currency, marketing_consent")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!withConsent.error) {
        consentKnown = true;
        order = withConsent.data as Record<string, unknown> | null;
      } else {
        console.warn(
          "[razorpay] orders.marketing_consent not available — apply migration 0010; " +
            "reporting to Meta as before"
        );
        const fallback = await admin
          .from("orders")
          .select("client_ip, client_ua, amount_paise, currency")
          .eq("order_id", orderId)
          .maybeSingle();
        order = fallback.data as Record<string, unknown> | null;
      }

      expectedMinor = order?.amount_paise == null ? null : Number(order.amount_paise);
      marketingConsent = order?.marketing_consent === true;
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
  // Gated on the marketing consent captured at checkout and stored on the order.
  // It CANNOT be read from a cookie here: this request is a server-to-server
  // POST from Razorpay, so it carries Razorpay's cookies and never the
  // visitor's. Reading the cookie in the webhook found nothing every time and
  // silently skipped CAPI for every purchase.
  //
  // Revenue recording is unaffected — this only decides whether Meta is told.
  if (orderId && typeof capturedMinor === "number") {
    if (consentKnown && !marketingConsent) {
      console.log(
        `[razorpay] marketing consent not granted for ${orderId} — skipping Meta CAPI`
      );
    } else {
      const currency = isCurrency(orderCurrency) ? orderCurrency : "INR";
      await sendCapiPurchase({
        value: fromMinorUnits(capturedMinor, currency),
        currency,
        eventId: orderId,
        clientIp,
        ua: clientUa,
      });
    }
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
    }
  }

  return NextResponse.json({ received: true });
}
