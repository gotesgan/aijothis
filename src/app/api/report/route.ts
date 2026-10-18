import { NextResponse } from "next/server";
import { computeKundli, getUtcOffsetMinutes } from "@/lib/kundli";
import { isGender } from "@/lib/types";
import {
  buildFacts,
  isReportType,
  reportPackId,
  REPORT_PRICES,
  type ReportType,
} from "@/lib/report";
import {
  generateFullReport,
  getStoredReport,
  hasReportPurchase,
  saveReport,
} from "@/lib/report-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { REGION_CURRENCY } from "@/lib/geo";
import { resolveRegionFromRequest } from "@/lib/region-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/report
 *
 * Body carries `type` ("marriage" | "career" | "child", default "marriage") so
 * one endpoint serves all three reports — the type picks the price, the pack id
 * and the section set. Everything else (chart computation, profile persistence,
 * purchase gate, persistence) is shared.
 *
 * stage "teaser" → free. Computes the chart and returns the raw placements the
 * client renders as the teaser. No payment, no LLM, instant.
 *
 * stage "full" → requires a settled order for this device + report type. Runs
 * the LLM narrative (falls back to a deterministic report) so a verified
 * payment is never left with an empty page.
 *
 * stage "download" → persists the rendered narrative (purchase-gated).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const { name, date, time, place, lat, lng, timezone, lang, stage } = body;
  const type: ReportType = isReportType(body.type) ? body.type : "marriage";
  if (!date || !time || lat == null || lng == null || !timezone) {
    return NextResponse.json({ error: "missing_birth_fields" }, { status: 400 });
  }

  const deviceId = request.headers.get("x-device-id");

  let kundli;
  try {
    const [y, m, d] = String(date).split("-").map(Number);
    const [hh, mm] = String(time).split(":").map(Number);
    const offsetMinutes = getUtcOffsetMinutes(
      new Date(Date.UTC(y, m - 1, d, hh, mm)),
      String(timezone)
    );
    kundli = await computeKundli({
      name: String(name ?? ""),
      date: String(date),
      time: String(time),
      place: String(place ?? ""),
      lat: Number(lat),
      lng: Number(lng),
      timezone: String(timezone),
      utcOffsetMinutes: offsetMinutes,
      gender: isGender(body.gender) ? body.gender : undefined,
    });
  } catch (err) {
    console.error("report chart computation failed", err);
    return NextResponse.json(
      { error: "computation_failed", message: (err as Error).message },
      { status: 500 }
    );
  }

  // Persist the profile (device-keyed) so this birth data is reusable across
  // the app afterwards. Non-fatal — the funnel works without Supabase.
  if (deviceId) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { error } = await admin.from("profiles").upsert(
        {
          device_id: deviceId,
          lang: String(lang ?? "en"),
          name: String(name ?? ""),
          birth_date: String(date),
          birth_time: String(time),
          birth_place: String(place ?? ""),
          lat: Number(lat),
          lng: Number(lng),
          timezone: String(timezone),
          kundli_json: kundli,
        },
        { onConflict: "device_id" }
      );
      if (error) console.warn("[supabase] report profile upsert:", error.message);
    }
  }

  if (stage !== "full" && stage !== "download") {
    // The teaser is free. It also reports whether this device already owns this
    // report, so a returning buyer sees "view your report" instead of being
    // asked to pay twice. One indexed read; no LLM.
    const currency = REGION_CURRENCY[resolveRegionFromRequest(request)];
    const purchased = deviceId ? await hasReportPurchase(deviceId, type) : false;
    return NextResponse.json({
      facts: buildFacts(kundli),
      price: REPORT_PRICES[type][currency],
      currency,
      purchased,
      type,
    });
  }

  // Paid stages. Device-scoped and settled-order-scoped.
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }
  if (!(await hasReportPurchase(deviceId, type))) {
    return NextResponse.json({ error: "not_purchased" }, { status: 402 });
  }

  const currency = REGION_CURRENCY[resolveRegionFromRequest(request)];
  const packId = reportPackId(type, currency);

  // Download/handoff: persist the rendered narrative so a re-visit is re-served
  // the same prose (and the chat can answer from it) rather than paying for a
  // second LLM run. Client supplies the sections it is already showing.
  if (stage === "download") {
    const ok = await saveReport({
      deviceId,
      packId,
      locale: String(lang ?? "en"),
      type,
      facts: buildFacts(kundli),
      sections: Array.isArray(body.sections) ? body.sections : [],
    });
    return NextResponse.json({ ok });
  }

  // Re-use a stored report when one exists; otherwise generate (and the client
  // will persist it on download). Guarantees the same text on every view.
  const stored = await getStoredReport(deviceId, packId, type);
  const sections =
    stored ?? (await generateFullReport(kundli, String(lang ?? "en"), type));
  return NextResponse.json({ facts: buildFacts(kundli), sections });
}
