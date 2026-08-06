import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * Returns the user's latest chat thread (for restoring history on return).
 * Paginated: by default the newest `limit` messages; pass `before=<id>` to load
 * an older page. `hasMore` is true when earlier messages exist.
 */
export async function GET(request: Request) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) return NextResponse.json({ error: "missing_device" }, { status: 400 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? PAGE_SIZE), 1), 50);
  const before = url.searchParams.get("before");

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ chatId: null, messages: [], hasMore: false });

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!profile) return NextResponse.json({ chatId: null, messages: [], hasMore: false });

    const { data: chat } = await admin
      .from("chats")
      .select("id")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chat) return NextResponse.json({ chatId: null, messages: [], hasMore: false });

    let query = admin
      .from("messages")
      .select("id,role,content,created_at")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (before) query = query.lt("id", before);
    const { data } = await query;
    if (!data) return NextResponse.json({ chatId: chat.id, messages: [], hasMore: false });

    // Deterministic newest-first regardless of DB ordering quirks.
    const page = [...data].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        b.id.localeCompare(a.id)
    );

    // We fetched newest-first; hand back oldest→newest for rendering.
    const messages = page
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content,
      }));

    // hasMore = are there older messages beyond this page?
    let hasMore = false;
    const oldestId = messages[0]?.id;
    if (oldestId) {
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", chat.id)
        .lt("id", oldestId);
      hasMore = (count ?? 0) > 0;
    }

    return NextResponse.json({ chatId: chat.id, messages, hasMore });
  } catch (err) {
    console.warn("[supabase] history load failed:", (err as Error).message);
    return NextResponse.json({ chatId: null, messages: [], hasMore: false });
  }
}
