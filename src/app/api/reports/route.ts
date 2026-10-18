import { NextResponse } from "next/server";

import { REGION_CURRENCY } from "@/lib/geo";
import { REPORT_PRICES, reportPackId, type ReportType } from "@/lib/report";
import { getStoredReport, hasReportPurchase } from "@/lib/report-server";
import { resolveRegionFromRequest } from "@/lib/region-server";
import { resolvePricingForDevice } from "@/lib/pricing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Which readings have I already unlocked?"
 *
 * A paid report was previously only discoverable by walking back into its page
 * and re-entering birth details, and the hub listed all three as if none had
 * been bought. Someone who has paid should be able to see it and open it.
 *
 * Two separate facts per type, because they mean different things:
 *   purchased — a settled order exists (they own it, forever)
 *   stored    — the generated narrative is on disk (so opening it is instant
 *               rather than a fresh LLM run)
 *
 * Trust model: scoped by the `x-device-id` header, exactly like /api/me and
 * /api/orders, and ownership is resolved across the person's google-linked
 * devices so a buyer is never invited to pay again on a second device.
 */
export async function GET(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const currency = REGION_CURRENCY[resolveRegionFromRequest(request)];
  // One lookup for the whole request: ownership spans google-linked devices.
  const { deviceIds } = await resolvePricingForDevice(deviceId);
  const types: ReportType[] = ["marriage", "career", "child"];

  const reports = await Promise.all(
    types.map(async (type) => {
      const purchased = await hasReportPurchase(deviceId, type, deviceIds);
      const stored = purchased
        ? Boolean(await getStoredReport(deviceId, reportPackId(type, currency), type))
        : false;
      return { type, purchased, stored, price: REPORT_PRICES[type][currency] };
    })
  );

  return NextResponse.json({ currency, reports });
}
