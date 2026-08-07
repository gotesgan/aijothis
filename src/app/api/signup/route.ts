import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a Google signup for the experiment.
 *
 * When the client passes a Google credential (ID token JWT), the token is
 * verified against Google's tokeninfo endpoint and the user's Google
 * identity (sub / email / name) is saved on the profile. Without a
 * credential (simulated/dev signup) it only records signed_up_at.
 */
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  const body = await request.json().catch(() => null);
  if (!deviceId) {
    return NextResponse.json({ error: "missing_device" }, { status: 400 });
  }

  const credential = typeof body?.credential === "string" ? body.credential : null;
  const lang = ["en", "hi", "mr"].includes(body?.lang) ? body.lang : "en";

  let googleUser: { sub: string; email: string; name: string } | null = null;
  if (credential) {
    googleUser = await verifyGoogleToken(credential);
    if (!googleUser) {
      // Invalid/expired/wrong-audience token — record the signup anyway but
      // don't persist a fake identity. The user is not blocked.
      console.warn("[signup] google token verification failed");
    }
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const signedUpAt = new Date().toISOString();

    // Try to update the existing device profile. If none exists (deleted,
    // never created, chart cached only in localStorage), upsert instead so
    // the Google identity is never silently dropped.
    const fields: Record<string, unknown> = {
      signed_up_at: signedUpAt,
    };
    if (googleUser) {
      fields.google_sub = googleUser.sub;
      fields.email = googleUser.email;
      fields.google_name = googleUser.name;
    }

    const { data: updated, error } = await admin
      .from("profiles")
      .update(fields)
      .eq("device_id", deviceId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[supabase] signup update failed:", error.message);
    }

    if (!updated) {
      const { error: insertErr } = await admin.from("profiles").insert({
        device_id: deviceId,
        lang,
        ...fields,
      });
      if (insertErr) {
        console.warn("[supabase] signup insert failed:", insertErr.message);
      }
    }
  }

  return NextResponse.json({ ok: true, google: googleUser ? { email: googleUser.email } : null });
}

/**
 * Verifies a Google ID token via Google's tokeninfo endpoint and checks it
 * was issued for OUR client id and is not expired. Returns the user claims,
 * or null if invalid.
 */
async function verifyGoogleToken(credential: string): Promise<{ sub: string; email: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const info = (await res.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string;
      name?: string;
      exp?: string;
    };

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || info.aud !== clientId) return null;
    if (info.email_verified !== "true") return null;
    if (info.exp && Number(info.exp) * 1000 < Date.now()) return null;
    if (!info.sub || !info.email) return null;

    return { sub: info.sub, email: info.email, name: info.name ?? "" };
  } catch {
    return null;
  }
}
