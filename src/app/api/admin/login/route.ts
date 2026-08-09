import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sessionToken, verifyPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

const cookie = (token: string) =>
  `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

/** POST { username, password } → sets an httpOnly admin cookie on success. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("admin_users")
    .select("username,password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("[admin/login] lookup failed:", error.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (!data || !verifyPassword(password, data.password_hash)) {
    return NextResponse.json({ error: "bad_credentials" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie(sessionToken(data.username, data.password_hash)) } }
  );
}

/** DELETE → clears the admin cookie. */
export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": "admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" } }
  );
}
