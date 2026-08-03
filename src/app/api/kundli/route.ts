import { NextResponse } from "next/server";
import { computeKundli, getUtcOffsetMinutes } from "@/lib/kundli";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { name, date, time, place, lat, lng, timezone, lang, mobile } = body;

  if (!date || !time || lat == null || lng == null || !timezone) {
    return NextResponse.json(
      { error: "missing_birth_fields" },
      { status: 400 }
    );
  }

  try {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const offsetMinutes = getUtcOffsetMinutes(
      new Date(Date.UTC(y, m - 1, d, hh, mm)),
      timezone
    );

    const kundli = await computeKundli({
      name: String(name ?? ""),
      date,
      time,
      place: String(place ?? ""),
      lat: Number(lat),
      lng: Number(lng),
      timezone,
      utcOffsetMinutes: offsetMinutes,
    });

    // Persist the profile (device-keyed) when Supabase is configured.
    const deviceId = request.headers.get("x-device-id");
    const admin = getSupabaseAdmin();
    if (deviceId && admin) {
      const { error } = await admin.from("profiles").upsert(
        {
          device_id: deviceId,
          lang: String(lang ?? "en"),
          name: String(name ?? ""),
          mobile: mobile ? String(mobile).replace(/\s/g, "") : null,
          birth_date: date,
          birth_time: time,
          birth_place: String(place ?? ""),
          lat: Number(lat),
          lng: Number(lng),
          timezone,
          kundli_json: kundli,
        },
        { onConflict: "device_id" }
      );
      if (error) console.warn("[supabase] profile upsert:", error.message);
    }

    return NextResponse.json({ kundli });
  } catch (err) {
    console.error("kundli computation failed", err);
    return NextResponse.json(
      { error: "computation_failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}
