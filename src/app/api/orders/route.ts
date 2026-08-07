import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How old an abandoned (created) order can be and still be worth resuming. */
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Marks a checkout order as `failed` after a payment attempt failed or was
 * dismissed client-side. Mirrors Razorpay's `attempted` status so a dropped
 * attempt is no longer surfaced as a stale "pending resume" candidate. This
 * is the client-side counterpart to the payment.failed webhook (works even
 * when the webhook isn't configured).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  if (!orderId) {
    return NextResponse.json({ error: "missing_order" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("order_id", orderId);
    } catch (err) {
      console.warn("[orders] mark failed error:", (err as Error).message);
    }
  }
  return NextResponse.json({ ok: true });
}

/**
 * Checkout reconciliation for a device.
 *
 * Returns what the DB knows about this device's payments so the client can:
 *  - catch up grants when localStorage is behind (webhook-only payments,
 *    cleared storage) — a paying user must never be left gated;
 *  - surface a recent abandoned checkout as a resume-payment prompt.
 */
export async function GET(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ paidQuestionsTotal: 0, hasP60: false, latestPaidAt: null, pending: null });
  }

  try {
    const { data: orders, error } = await admin
      .from("orders")
      .select("pack_id, pack_questions, amount_paise, status, verified_at, created_at, order_id")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !orders) {
      console.warn("[orders] fetch failed:", error?.message);
      return NextResponse.json({ paidQuestionsTotal: 0, hasP60: false, latestPaidAt: null, pending: null });
    }

    const paid = orders.filter((o) => o.status === "paid");
    const paidQuestionsTotal = paid.reduce(
      (sum, o) => sum + (Number(o.pack_questions) || 0),
      0
    );
    const hasP60 = paid.some((o) => o.pack_id === "p60");
    const latestPaid = paid[0] ?? null;

    const now = Date.now();
    // Surface the most recent created order as a resume candidate — but only
    // if no payment succeeded after it (a `created` that predates a `paid`
    // is a stale failed/dropped attempt, not something to nag about).
    let pending = null;
    for (const o of orders) {
      if (o.status !== "created") continue;
      if (now - new Date(o.created_at).getTime() >= PENDING_WINDOW_MS) continue;
      const newerPaid = paid.some(
        (p) => new Date(p.created_at).getTime() > new Date(o.created_at).getTime()
      );
      if (newerPaid) continue;
      pending = o;
      break;
    }

    return NextResponse.json({
      paidQuestionsTotal,
      hasP60,
      latestPaidAt: latestPaid?.verified_at ?? null,
      pending: pending
        ? {
            orderId: pending.order_id,
            packId: pending.pack_id,
            amountPaise: Number(pending.amount_paise) || 0,
          }
        : null,
    });
  } catch (err) {
    console.warn("[orders] reconcile failed:", (err as Error).message);
    return NextResponse.json({ paidQuestionsTotal: 0, hasP60: false, latestPaidAt: null, pending: null });
  }
}
