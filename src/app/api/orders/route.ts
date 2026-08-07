import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How old an abandoned (created) order can be and still be worth resuming. */
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    const pending = orders.find(
      (o) => o.status === "created" && now - new Date(o.created_at).getTime() < PENDING_WINDOW_MS
    );

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
