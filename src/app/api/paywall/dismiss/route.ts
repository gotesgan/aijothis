import { NextResponse } from "next/server";
import { recordPaywallDismissal } from "@/lib/bonus-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records that this person closed the paywall without buying.
 *
 * Called from the paywall's "Not now" button. Returns the entitlement so the
 * third dismissal can reveal the bonus immediately, without the client
 * guessing from its own counter — the counter the client keeps is cosmetic and
 * is never trusted for the decision.
 */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const entitlement = await recordPaywallDismissal(deviceId);
  return NextResponse.json(entitlement);
}