import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, razorpayConfigured, KEY_ID } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a Razorpay order for the chosen pack (or simulates without keys). */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  const body = await request.json().catch(() => null);
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const amountPaise = Number(body?.amountPaise ?? 1500);
  if (!Number.isInteger(amountPaise) || amountPaise < 1000 || amountPaise > 6000) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const packId = String(body?.packId ?? "");
  const packQuestions = Number(body?.packQuestions ?? 0);

  // Real payment path.
  if (razorpayConfigured()) {
    try {
      const order = await createRazorpayOrder(deviceId, amountPaise);
      await recordOrder({
        deviceId,
        amountPaise: order.amount,
        currency: order.currency,
        packId,
        packQuestions,
        orderId: order.id,
        status: "created",
      });
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
  await recordOrder({
    deviceId,
    amountPaise,
    currency: "INR",
    packId,
    packQuestions,
    status: "simulated",
  });
  return NextResponse.json({ simulated: true, ok: true });
}

/** Inserts an order row. Non-fatal — existing flow keeps working even if the
 *  `orders` table doesn't exist yet (migration not applied). */
async function recordOrder(params: {
  deviceId: string;
  amountPaise: number;
  currency: string;
  packId: string;
  packQuestions: number;
  orderId?: string;
  status: "created" | "simulated" | "paid";
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

    await admin.from("orders").insert({
      device_id: params.deviceId,
      profile_id: profileId,
      amount_paise: params.amountPaise,
      currency: params.currency,
      pack_id: params.packId || null,
      pack_questions: params.packQuestions || null,
      order_id: params.orderId ?? null,
      status: params.status,
      verified_at: params.status === "simulated" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.warn("[supabase] order record skipped:", (err as Error).message);
  }
}
