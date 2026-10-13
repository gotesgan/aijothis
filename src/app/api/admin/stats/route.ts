import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifySessionToken } from "@/lib/admin-auth";
import { fromMinorUnits, isCurrency } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** IST (UTC+5:30) — the business clock for all day-bucketing. */
const IST_MS = 5.5 * 60 * 60 * 1000;

function dayKey(ts: number): string {
  return new Date(ts + IST_MS).toISOString().slice(0, 10);
}

/** Start-of-day (IST) for `offsetDays` ago, as a Date. */
function dayStart(offsetDays: number): Date {
  const now = Date.now();
  const local = new Date(now + IST_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IST_MS + offsetDays * 86400000);
}

/** Paise → rupees. INR-only; foreign revenue is reported in `revenue.byCurrency`. */
const inr = (paise: number) => paise / 100;

export async function GET(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 500 });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  const token = match ? match[1] : null;
  const username = token?.split(".")[0];

  // Verify the session token against the stored admin identity in the DB.
  const { data: adminUser, error: authError } = await admin
    .from("admin_users")
    .select("username,password_hash")
    .eq("username", username ?? "")
    .maybeSingle();

  if (authError) {
    console.error("[admin/stats] auth lookup failed:", authError.message);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
  if (!adminUser || !verifySessionToken(token ?? undefined, adminUser.username, adminUser.password_hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const todayStart = dayStart(0).getTime();
  const last7Start = dayStart(-6).getTime();
  const last30Start = dayStart(-29).getTime();

  try {
    const [ordersRes, profilesRes, chatsRes, msgsCount, msgsTodayCount, msgs7dCount, userMsgsRes] =
      await Promise.all([
        admin.from("orders").select("id,device_id,amount_paise,currency,pack_id,status,created_at,verified_at"),
        admin.from("profiles").select("id,device_id,lang,created_at,signed_up_at,birth_date"),
        admin.from("chats").select("id,profile_id,created_at"),
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user"),
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", new Date(todayStart).toISOString()),
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", new Date(last7Start).toISOString()),
        admin.from("messages").select("chat_id,created_at").eq("role", "user").limit(100000),
      ]);

    if (
      ordersRes.error ||
      profilesRes.error ||
      chatsRes.error ||
      msgsCount.error ||
      msgsTodayCount.error ||
      msgs7dCount.error ||
      userMsgsRes.error
    ) {
      console.error("[admin] fetch failed", {
        o: ordersRes.error?.message,
        p: profilesRes.error?.message,
        c: chatsRes.error?.message,
        m: userMsgsRes.error?.message,
      });
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    const orders = ordersRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const chats = chatsRes.data ?? [];
    const userMsgs = userMsgsRes.data ?? [];
    const questionsTotal = msgsCount.count ?? 0;
    const questionsToday = msgsTodayCount.count ?? 0;
    const questions7d = msgs7dCount.count ?? 0;

    // ── Revenue ──────────────────────────────────────────────
    const paid = orders.filter((o) => o.status === "paid");

    // `amount_paise` holds MINOR UNITS OF WHATEVER CURRENCY THE ORDER WAS
    // CHARGED IN. Summing across currencies would add dollars to rupees and
    // produce a number that means nothing, so every rupee figure below is
    // scoped to INR orders only and foreign revenue is reported separately.
    const paidInr = paid.filter((o) => (o.currency ?? "INR") === "INR");

    // Revenue split by currency, so the business view is honest and the
    // foreign line is visible the moment it stops being zero.
    const byCurrencyMap = new Map<
      string,
      { currency: string; orders: number; revenueMinor: number; last30Minor: number }
    >();
    for (const o of paid) {
      const currency = o.currency ?? "INR";
      const e =
        byCurrencyMap.get(currency) ??
        { currency, orders: 0, revenueMinor: 0, last30Minor: 0 };
      const amount = Number(o.amount_paise || 0);
      e.orders += 1;
      e.revenueMinor += amount;
      if (new Date(o.created_at).getTime() >= last30Start) e.last30Minor += amount;
      byCurrencyMap.set(currency, e);
    }
    const byCurrency = [...byCurrencyMap.values()]
      .map(({ currency, orders, revenueMinor, last30Minor }) => ({
        currency,
        orders,
        // `null` rather than a coerced number for an unrecognised code — an
        // unmapped currency is a bug to surface, not a total to trust.
        revenue: isCurrency(currency) ? fromMinorUnits(revenueMinor, currency) : null,
        last30: isCurrency(currency) ? fromMinorUnits(last30Minor, currency) : null,
      }))
      .sort((a, b) => b.orders - a.orders);

    const revenueTotal = paidInr.reduce((s, o) => s + Number(o.amount_paise || 0), 0);
    const revenueToday = paidInr
      .filter((o) => new Date(o.created_at).getTime() >= todayStart)
      .reduce((s, o) => s + Number(o.amount_paise || 0), 0);

    const sumSince = (start: number) =>
      paidInr
        .filter((o) => new Date(o.created_at).getTime() >= start)
        .reduce((s, o) => s + Number(o.amount_paise || 0), 0);

    const revenue7d = sumSince(last7Start);
    const revenue30d = sumSince(last30Start);

    // ARR/MRR proxies — one-time packs, not subscriptions. MRR = trailing 30d
    // revenue (annualized for ARR). Honest framing, not invented subscription math.
    const daysLive = paidInr.length ? Math.max(1, Math.round((now - Math.min(...paidInr.map((o) => new Date(o.created_at).getTime()))) / 86400000)) : 0;
    const mrrProxy = revenue30d; // trailing 30 days
    const arrProxy = Math.round(inr(mrrProxy) * 12);
    const avgOrderValue = paidInr.length ? inr(revenueTotal) / paidInr.length : 0;

    // revenue by pack — grouped per pack id, and pack ids are currency-scoped,
    // so each row is single-currency by construction.
    const byPack = new Map<string, { orders: number; revenue: number }>();
    for (const o of paidInr) {
      const key = o.pack_id ?? "unknown";
      const e = byPack.get(key) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(o.amount_paise || 0);
      byPack.set(key, e);
    }
    const packBreakdown = [...byPack.entries()]
      .map(([packId, v]) => ({ packId, ...v, revenueInr: inr(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    // revenue by day — last 14 days (zero-filled), INR only, bucketed by IST
    // which remains the right business clock for the India revenue line.
    const daily = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(dayStart(-i).getTime());
      const key = dayKey(d.getTime());
      daily.set(key, { date: key, revenue: 0, orders: 0 });
    }
    for (const o of paidInr) {
      const key = dayKey(new Date(o.created_at).getTime());
      const e = daily.get(key);
      if (e) {
        e.revenue += Number(o.amount_paise || 0);
        e.orders += 1;
      }
    }
    const revenueByDay = [...daily.values()].map((d) => ({ ...d, revenueInr: inr(d.revenue) }));

    // orders health
    const orderHealth = {
      paid: paid.length,
      created: orders.filter((o) => o.status === "created").length,
      failed: orders.filter((o) => o.status === "failed").length,
      simulated: orders.filter((o) => o.status === "simulated").length,
      pending: orders.filter((o) => o.status === "created" && new Date(o.created_at).getTime() > todayStart - 86400000).length,
    };

    // ── Users / signups ─────────────────────────────────────
    const profileCreatedTs = profiles.map((p) => new Date(p.created_at).getTime());
    const totalUsers = profiles.length;
    const newToday = profileCreatedTs.filter((t) => t >= todayStart).length;
    const new7d = profileCreatedTs.filter((t) => t >= last7Start).length;
    const new30d = profileCreatedTs.filter((t) => t >= last30Start).length;
    const signedUp = profiles.filter((p) => p.signed_up_at).length;

    const langSplit = { en: 0, hi: 0, mr: 0, other: 0 };
    for (const p of profiles) {
      const l = p.lang ?? "other";
      if (l === "en" || l === "hi" || l === "mr") langSplit[l as keyof typeof langSplit] += 1;
      else langSplit.other += 1;
    }

    // funnel: profiles → with birth details → started a chat → paid
    const withDetails = profiles.filter((p) => p.birth_date).length;
    const chatProfileIds = new Set(chats.map((c) => c.profile_id));
    const withChat = chatProfileIds.size;
    const paidDeviceIds = new Set(paid.map((o) => o.device_id));
    const payingUsers = paidDeviceIds.size;

    // ── Engagement (counts only — never content) ────────────
    const chatIdToProfile = new Map(chats.map((c) => [c.id, c.profile_id]));
    const askerProfileIds = new Set<string>();
    for (const m of userMsgs) {
      const pid = chatIdToProfile.get(m.chat_id);
      if (pid) askerProfileIds.add(pid);
    }
    const askers = askerProfileIds.size;

    // ── Retention ───────────────────────────────────────────
    const perDevice = new Map<string, number[]>();
    for (const o of paid) {
      const arr = perDevice.get(o.device_id) ?? [];
      arr.push(new Date(o.created_at).getTime());
      perDevice.set(o.device_id, arr);
    }
    let repeatPayers = 0;
    let crossDayPayers = 0;
    for (const times of perDevice.values()) {
      if (times.length > 1) repeatPayers += 1;
      const days = new Set(times.map(dayKey));
      if (days.size > 1) crossDayPayers += 1;
    }

    const response = {
      generatedAt: new Date().toISOString(),
      revenue: {
        totalInr: inr(revenueTotal),
        todayInr: inr(revenueToday),
        last7Inr: inr(revenue7d),
        last30Inr: inr(revenue30d),
        mrrProxyInr: inr(mrrProxy),
        arrProxyInr: arrProxy,
        avgOrderValue,
        daysLive,
        byCurrency,
        daily: revenueByDay,
        byPack: packBreakdown,
        orderHealth,
      },
      users: {
        total: totalUsers,
        newToday,
        new7d,
        new30d,
        signedUp,
        payingUsers,
        lang: langSplit,
      },
      funnel: {
        total: totalUsers,
        withDetails,
        withChat,
        paid: payingUsers,
      },
      engagement: {
        questionsTotal,
        questionsToday,
        questions7d,
        askers,
        avgQuestionsPerAsker: askers ? questionsTotal / askers : 0,
      },
      retention: {
        repeatPayers,
        crossDayPayers,
        payers: payingUsers,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[admin/stats] failed:", (err as Error).message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
