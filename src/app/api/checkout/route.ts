import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, razorpayConfigured, KEY_ID } from "@/lib/razorpay";
import { packForTier, packQuestionsFor } from "@/lib/pricing";
import { resolvePricingForDevice } from "@/lib/pricing-server";
import { resolveBonusForDevice, consumeBonus } from "@/lib/bonus-server";
import { REGION_CURRENCY } from "@/lib/geo";
import { resolveRegionFromRequest } from "@/lib/region-server";
import { toMinorUnits } from "@/lib/money";
import { consentFromCookie, CONSENT_COOKIE } from "@/lib/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a Razorpay order for the chosen pack (or simulates without keys). */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  const body = await request.json().catch(() => null);
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  // Customer's real IP + User-Agent, captured from THIS browser request.
  // Stored on the order so the Razorpay webhook (which runs server-to-server
  // from Razorpay, carrying their IP not the customer's) can send real
  // matching data to the Meta Conversions API.
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const clientUa = request.headers.get("user-agent") ?? null;

  // Region is derived here, server-side, from the edge country header and the
  // sticky region cookie. The browser never states its own region — it only
  // sends a tier, and the tier is meaningless without a resolved market.
  const region = resolveRegionFromRequest(request);
  const currency = REGION_CURRENCY[region];

  const { cohort } = await resolvePricingForDevice(deviceId);
  const pack = packForTier(cohort, String(body?.packTier ?? ""), currency);
  if (!pack) return NextResponse.json({ error: "invalid_pack" }, { status: 400 });

  // Prices and question credits are server-owned. Never trust a value supplied
  // by the browser at checkout.
  const amountMinor = toMinorUnits(pack.price, pack.currency);

  // Loyalty bonus: earned by dismissing the paywall repeatedly, grants extra
  // questions at the SAME price. It never changes `amountMinor` — only the
  // credit count persisted on the order, which is what the webhook grants. The
  // browser is not asked whether the bonus applies; it sends a tier only.
  const { earned: bonusEarned } = await resolveBonusForDevice(deviceId);

  // Marketing consent is captured HERE, not in the webhook: this request comes
  // from the visitor's browser so their consent cookie is attached, whereas the
  // Razorpay webhook is a server-to-server POST carrying none of it. Stored on
  // the order so the webhook can read it back.
  const marketingConsent =
    consentFromCookie(
      request.headers
        .get("cookie")
        ?.split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${CONSENT_COOKIE}=`))
        ?.slice(CONSENT_COOKIE.length + 1)
    )?.marketing === true;
  const packId = pack.id;
  // What the webhook will actually grant. Shared rule with the client, so the
  // "60 questions" in the paywall and the 60 in the ledger cannot diverge.
  const packQuestions = packQuestionsFor(cohort, pack, bonusEarned);
  // Echoed back so the client can assert it showed what it charged.
  const grantedPack = { ...pack, questions: packQuestions };

  // Real payment path.
  if (razorpayConfigured()) {
    try {
      // Idempotency: if there's already a recent `created` order for this
      // device + pack at the same price and credit count (a sheet that was
      // dismissed or failed to open, attempts:0), REUSE it instead of creating
      // a duplicate. Rechecking the amount and credits also makes a changed
      // price or newly earned bonus safe across menu revisions.
      //
      // `pack_id` is cohort- AND currency-scoped, so an abandoned INR order is
      // never reused to fulfil a USD checkout — that would charge the INR
      // amount on a Razorpay order created in INR while the client opens a
      // sheet expecting dollars.
      const admin = getSupabaseAdmin();
      if (admin) {
        const existing = await admin
          .from("orders")
          .select("order_id, amount_paise, currency, pack_questions")
          .eq("device_id", deviceId)
          .eq("pack_id", packId)
          .eq("status", "created")
          .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // The currency is re-asserted, not assumed. `pack_id` scoping makes a
        // cross-currency reuse impossible in practice, but `orders.currency` is
        // an unconstrained text column — if any future writer sets pack_id
        // without setting currency, this refuses to reuse rather than charging
        // one currency while the client renders another.
        if (
          existing?.data?.order_id &&
          existing.data.currency === pack.currency &&
          Number(existing.data.amount_paise) === amountMinor &&
          Number(existing.data.pack_questions) === packQuestions
        ) {
          const reused = existing.data;
          return NextResponse.json({
            orderId: reused.order_id,
            amount: reused.amount_paise,
            currency: reused.currency,
            region,
            keyId: KEY_ID,
            pack: grantedPack,
            simulated: false,
            reused: true,
          });
        }
      }

      const order = await createRazorpayOrder(deviceId, amountMinor, pack.currency);
      await recordOrder({
        deviceId,
        amountMinor: order.amount,
        currency: order.currency,
        packId,
        packQuestions,
        orderId: order.id,
        status: "created",
        marketingConsent,
        clientIp,
        clientUa,
      });
      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        region,
        keyId: KEY_ID,
        pack: grantedPack,
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
  // Spend the one-time bonus here too, or it would re-arm on every simulated
  // purchase and could never be observed as consumed.
  if (bonusEarned) await consumeBonus(deviceId);
  await recordOrder({
    deviceId,
    amountMinor,
    currency,
    packId,
    packQuestions,
    status: "simulated",
    marketingConsent,
    clientIp,
    clientUa,
  });
  return NextResponse.json({ simulated: true, ok: true, pack: grantedPack, region });
}

/** Inserts an order row. Non-fatal — existing flow keeps working even if the
 *  `orders` table doesn't exist yet (migration not applied). */
async function recordOrder(params: {
  deviceId: string;
  /** Minor units in `currency`. Maps to the legacy-named `amount_paise` column. */
  amountMinor: number;
  currency: string;
  packId: string;
  packQuestions: number;
  orderId?: string;
  status: "created" | "simulated" | "paid";
  marketingConsent?: boolean;
  clientIp?: string | null;
  clientUa?: string | null;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    // Link the profile when it exists.
    let profileId: string | null = null;
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("device_id", params.deviceId)
      .maybeSingle();
    if (profile?.id) profileId = profile.id;

    // Two-step so an unapplied migration degrades instead of destroying the
    // order row. recordOrder swallows errors, so a plain INSERT naming a column
    // that does not exist yet fails SILENTLY — no order recorded means the
    // webhook finds nothing, matches nothing, and a paying customer is never
    // granted their questions.
    const row = {
      device_id: params.deviceId,
      profile_id: profileId,
      // The column predates multi-currency and is still named `amount_paise`,
      // but it stores minor units of whatever `currency` says.
      amount_paise: params.amountMinor,
      currency: params.currency,
      pack_id: params.packId || null,
      pack_questions: params.packQuestions || null,
      order_id: params.orderId ?? null,
      status: params.status,
      verified_at: params.status === "simulated" ? new Date().toISOString() : null,
    };
    const withConsent = await admin
      .from("orders")
      .insert({ ...row, marketing_consent: params.marketingConsent ?? false });
    if (withConsent.error) {
      console.warn(
        "[supabase] orders.marketing_consent not available — apply migration 0010; " +
          "recording order without the consent flag"
      );
      const fallback = await admin.from("orders").insert(row);
      if (fallback.error) {
        console.warn("[supabase] order record skipped:", fallback.error.message);
      }
    }

    // Best-effort: enrich the order with the customer's IP/UA for CAPI match
    // quality. Runs AFTER the base insert so order recording never breaks —
    // if the migration (client_ip/client_ua columns) hasn't been applied yet,
    // this fails quietly and the order is still recorded.
    if (params.clientIp || params.clientUa) {
      try {
        await admin
          .from("orders")
          .update({
            client_ip: params.clientIp ?? null,
            client_ua: params.clientUa ?? null,
          })
          .eq("order_id", params.orderId)
          .eq("status", params.status === "simulated" ? "simulated" : "created");
      } catch (err) {
        console.warn("[supabase] client-info enrichment skipped:", (err as Error).message);
      }
    }
  } catch (err) {
    console.warn("[supabase] order record skipped:", (err as Error).message);
  }
}
