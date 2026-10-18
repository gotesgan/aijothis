import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, razorpayConfigured, KEY_ID } from "@/lib/razorpay";
import {
  isReportType,
  reportPackId,
  REPORT_PRICES,
  type ReportType,
} from "@/lib/report";
import { REGION_CURRENCY } from "@/lib/geo";
import { resolveRegionFromRequest } from "@/lib/region-server";
import { toMinorUnits } from "@/lib/money";
import { consentFromCookie, CONSENT_COOKIE } from "@/lib/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/report-checkout
 *
 * Creates the Razorpay order for a one-off report. The browser sends only its
 * device id and the report `type` — the amount, currency and product id are all
 * server-owned, so the price shown and the price charged cannot drift. An
 * unknown type falls back to "marriage", never to a cheaper product.
 *
 * Uses the SAME /api/payment-verify endpoint on success, so report orders flow
 * through the existing signature-verified, device-scoped settlement path and
 * land in `orders` with `pack_id = report-<type>-<currency>`.
 */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const type: ReportType = isReportType(body?.type) ? body.type : "marriage";

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const clientUa = request.headers.get("user-agent") ?? null;

  const region = resolveRegionFromRequest(request);
  const currency = REGION_CURRENCY[region];

  const price = REPORT_PRICES[type][currency];
  const amountMinor = toMinorUnits(price, currency);
  const packId = reportPackId(type, currency);

  const marketingConsent =
    consentFromCookie(
      request.headers
        .get("cookie")
        ?.split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${CONSENT_COOKIE}=`))
        ?.slice(CONSENT_COOKIE.length + 1)
    )?.marketing === true;

  if (razorpayConfigured()) {
    try {
      // Idempotency: reuse a recent un-attempted order for the same device +
      // product + currency instead of spawning duplicates on rapid taps.
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data: existing } = await admin
          .from("orders")
          .select("order_id, amount_paise, currency")
          .eq("device_id", deviceId)
          .eq("pack_id", packId)
          .eq("status", "created")
          .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing?.order_id && existing.currency === currency) {
          return NextResponse.json({
            orderId: existing.order_id,
            amount: existing.amount_paise,
            currency: existing.currency,
            region,
            keyId: KEY_ID,
            price,
            simulated: false,
            reused: true,
          });
        }
      }

      const order = await createRazorpayOrder(deviceId, amountMinor, currency);
      await recordReportOrder({
        deviceId,
        amountMinor: order.amount,
        currency: order.currency,
        packId,
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
        price,
        simulated: false,
      });
    } catch (err) {
      console.error("report checkout failed:", (err as Error).message);
      return NextResponse.json(
        { error: "order_failed", message: (err as Error).message },
        { status: 500 }
      );
    }
  }

  // Simulated path (keys not configured) — recording a `simulated` report order
  // is what lets /api/report's paid stage be exercised locally.
  await recordReportOrder({
    deviceId,
    amountMinor,
    currency,
    packId,
    status: "simulated",
    marketingConsent,
    clientIp,
    clientUa,
  });
  return NextResponse.json({ simulated: true, ok: true, price, region, currency });
}

/** Records the report order. Non-fatal, and degrades if optional columns are
 *  missing so an unapplied migration can't silently swallow a paid order. */
async function recordReportOrder(params: {
  deviceId: string;
  amountMinor: number;
  currency: string;
  packId: string;
  orderId?: string;
  status: "created" | "simulated";
  marketingConsent?: boolean;
  clientIp?: string | null;
  clientUa?: string | null;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    let profileId: string | null = null;
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("device_id", params.deviceId)
      .maybeSingle();
    if (profile?.id) profileId = profile.id;

    const row = {
      device_id: params.deviceId,
      profile_id: profileId,
      amount_paise: params.amountMinor,
      currency: params.currency,
      pack_id: params.packId,
      // No chat credits are granted for a report — null, not 0.
      pack_questions: null,
      order_id: params.orderId ?? null,
      status: params.status,
      verified_at: params.status === "simulated" ? new Date().toISOString() : null,
    };
    const withConsent = await admin
      .from("orders")
      .insert({ ...row, marketing_consent: params.marketingConsent ?? false });
    if (withConsent.error) {
      const fallback = await admin.from("orders").insert(row);
      if (fallback.error) {
        console.warn("[supabase] report order record skipped:", fallback.error.message);
      }
    }

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
      } catch {
        // optional enrichment only
      }
    }
  } catch (err) {
    console.warn("[supabase] report order record skipped:", (err as Error).message);
  }
}
