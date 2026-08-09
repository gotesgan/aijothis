"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  LogOut,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Users,
  Repeat,
  Wallet,
  Sparkles,
  MessageSquareText,
  CircleDollarSign,
  Activity,
  Layers,
  BarChart3,
} from "lucide-react";

type Stats = {
  generatedAt: string;
  revenue: {
    totalInr: number;
    todayInr: number;
    last7Inr: number;
    last30Inr: number;
    mrrProxyInr: number;
    arrProxyInr: number;
    avgOrderValue: number;
    daysLive: number;
    daily: { date: string; revenueInr: number; orders: number }[];
    byPack: { packId: string; orders: number; revenueInr: number }[];
    orderHealth: { paid: number; created: number; failed: number; simulated: number; pending: number };
  };
  users: {
    total: number;
    newToday: number;
    new7d: number;
    new30d: number;
    signedUp: number;
    payingUsers: number;
    lang: { en: number; hi: number; mr: number; other: number };
  };
  funnel: { total: number; withDetails: number; withChat: number; paid: number };
  engagement: {
    questionsTotal: number;
    questionsToday: number;
    questions7d: number;
    askers: number;
    avgQuestionsPerAsker: number;
  };
  retention: { repeatPayers: number; crossDayPayers: number; payers: number };
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Hero numerals ───────────────────────────────────── */

function HeroNumeral({ value, label, sub, accent }: { value: string; label: string; sub: string; accent?: boolean }) {
  return (
    <div className="relative min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#71688a]">{label}</div>
      <div
        className={`mt-1 truncate font-[var(--stack-display)] text-3xl font-medium leading-none tracking-tight sm:text-4xl ${
          accent ? "text-[#ffb84d]" : "text-[#f7f1e5]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 truncate text-[11px] text-[#b4aac4]">{sub}</div>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        up ? "bg-[#f2c94c]/10 text-[#f2c94c]" : "bg-[#e0522e]/10 text-[#e0522e]"
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {value.toFixed(0)}%
    </span>
  );
}

/* ── KPI card ────────────────────────────────────────── */

function Kpi({
  label,
  value,
  sub,
  icon,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  delta?: number;
}) {
  return (
    <div className="group rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors hover:border-[#ffb84d]/30 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#71688a]">{label}</span>
        {icon && <span className="text-[#71688a] transition-colors group-hover:text-[#ffb84d]">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-[var(--stack-display)] text-2xl font-medium text-[#f7f1e5]">{value}</span>
        {typeof delta === "number" && <Delta value={delta} />}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[#71688a]">{sub}</div>}
    </div>
  );
}

/* ── Revenue area chart (SVG) ─────────────────────────── */

function RevenueChart({ daily }: { daily: Stats["revenue"]["daily"] }) {
  const W = 600;
  const H = 160;
  const pad = 8;
  const max = Math.max(10, ...daily.map((d) => d.revenueInr));
  const step = (W - pad * 2) / Math.max(1, daily.length - 1);

  const pts = daily.map((d, i) => {
    const x = pad + i * step;
    const y = H - pad - (d.revenueInr / max) * (H - pad * 2);
    return { x, y, ...d };
  });

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M${pts[0].x},${H - pad} L${line.split(" ").join(" L")} L${pts[pts.length - 1].x},${H - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue by day">
        <defs>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb84d" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffb84d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={W - pad}
            y1={H - pad - f * (H - pad * 2)}
            y2={H - pad - f * (H - pad * 2)}
            stroke="rgba(247,241,229,0.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#revArea)" />
        <polyline
          points={line}
          fill="none"
          stroke="#ffb84d"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="#0d0a16" stroke="#ffb84d" strokeWidth="1.5">
            <title>{`${p.date}: ${inr(p.revenueInr)} (${p.orders} orders)`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#71688a]">
        <span>{pts[0].date.slice(5).replace("-", "/")}</span>
        <span>{pts[pts.length - 1].date.slice(5).replace("-", "/")}</span>
      </div>
    </div>
  );
}

/* ── Pack split bars ──────────────────────────────────── */

function PackSplit({ byPack }: { byPack: Stats["revenue"]["byPack"] }) {
  const total = Math.max(1, byPack.reduce((s, p) => s + p.revenueInr, 0));
  const labels: Record<string, string> = { p10: "₹10 · 10", p20: "₹20 · 30", p30: "₹30 · 50", p60: "₹60 · 7d" };
  return (
    <div className="space-y-3">
      {byPack.map((p) => (
        <div key={p.packId}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-[#b4aac4]">{labels[p.packId] ?? p.packId}</span>
            <span className="text-[#f7f1e5]">
              {inr(p.revenueInr)} <span className="text-[#71688a]">· {num(p.orders)} ord</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#9a6b1f] to-[#ffb84d]"
              style={{ width: `${(p.revenueInr / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Funnel ──────────────────────────────────────────── */

function Funnel({ funnel }: { funnel: Stats["funnel"] }) {
  const steps = [
    { label: "Profiles", value: funnel.total },
    { label: "Birth details", value: funnel.withDetails },
    { label: "Started chat", value: funnel.withChat },
    { label: "Paid", value: funnel.paid },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / funnel.total) * 100);
        const drop = i > 0 ? Math.round((1 - s.value / Math.max(1, steps[i - 1].value)) * 100) : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[#b4aac4]">{s.label}</span>
              <span className="flex items-center gap-2">
                {drop !== null && drop > 0 && (
                  <span className="text-[#71688a]">−{drop}%</span>
                )}
                <span className="font-medium text-[#f7f1e5]">{num(s.value)}</span>
                <span className="w-9 text-right text-[#71688a]">{pct}%</span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${i === steps.length - 1 ? "bg-[#f2c94c]" : "bg-[#ffb84d]/80"}`}
                style={{ width: `${Math.max(1, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Language split ──────────────────────────────────── */

function LangSplit({ lang }: { lang: Stats["users"]["lang"] }) {
  const rows = [
    { key: "hi", label: "Hindi" },
    { key: "mr", label: "Marathi" },
    { key: "en", label: "English" },
    { key: "other", label: "Other" },
  ] as const;
  const total = Math.max(1, lang.hi + lang.mr + lang.en + lang.other);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] text-[#b4aac4]">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-[#f2c94c]/70" style={{ width: `${(lang[r.key] / total) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] text-[#71688a]">{num(lang[r.key])}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat row ────────────────────────────────────────── */

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="text-[11px] text-[#b4aac4]">{label}</span>
      <div className="flex items-baseline gap-2">
        {hint && <span className="text-[10px] text-[#71688a]">{hint}</span>}
        <span className="text-sm font-medium text-[#f7f1e5]">{value}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb84d]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ── Goal bar: today vs ₹150/day target ─────────────── */

function GoalBar({ todayInr }: { todayInr: number }) {
  const goal = 150;
  const pct = Math.min(100, (todayInr / goal) * 100);
  return (
    <div className="rounded-xl border border-[#ffb84d]/20 bg-gradient-to-r from-[#ffb84d]/[0.07] to-transparent p-4">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="uppercase tracking-wider text-[#b4aac4]">Today vs daily target</span>
        <span className="font-medium text-[#ffb84d]">
          {inr(todayInr)} <span className="text-[#71688a]">/ {inr(goal)}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ffb84d] to-[#f2c94c] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-[#71688a]">{pct.toFixed(0)}% of goal · target = healthy ₹150/day</div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────── */

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"loading" | "authed" | "needs_pass" | "error">("loading");
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          setStats((await res.json()) as Stats);
          setStatus("authed");
          return;
        }
        if (res.status === 401) {
          setStatus("needs_pass");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `HTTP ${res.status}`);
        setStatus("error");
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setStatus("error");
      }
    }
    void load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [refreshTick]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setPassword("");
      setRefreshTick((x) => x + 1);
    } else {
      setError("Wrong username or password");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setStatus("needs_pass");
    setStats(null);
  };

  const deltas = useMemo(() => {
    if (!stats) return { today: undefined, week: undefined };
    const daily = stats.revenue.daily;
    const today = daily[daily.length - 1]?.revenueInr ?? 0;
    const yesterday = daily[daily.length - 2]?.revenueInr ?? 0;
    const todayDelta = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : undefined;
    const prev = daily.slice(0, -7);
    const prev7 = prev.length ? prev.reduce((s, d) => s + d.revenueInr, 0) : 0;
    const weekDelta = prev7 > 0 ? ((stats.revenue.last7Inr - prev7) / prev7) * 100 : undefined;
    return { today: todayDelta, week: weekDelta };
  }, [stats]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0a16]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#ffb84d]/20 border-t-[#ffb84d]" />
          </div>
          <span className="text-xs text-[#71688a]">Reading the charts…</span>
        </div>
      </div>
    );
  }

  if (status === "needs_pass" || status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0a16] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#141027] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ffb84d]/10">
              <BarChart3 className="h-4.5 w-4.5 text-[#ffb84d]" />
            </div>
            <div>
              <div className="font-[var(--stack-display)] text-sm font-medium text-[#f7f1e5]">Control Center</div>
              <div className="text-[10px] uppercase tracking-wider text-[#71688a]">Jyotish — private</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              autoComplete="username"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f7f1e5] outline-none transition-colors placeholder:text-[#71688a] focus:border-[#ffb84d]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f7f1e5] outline-none transition-colors placeholder:text-[#71688a] focus:border-[#ffb84d]"
            />
            {error && <div className="text-xs text-[#e0522e]">{error}</div>}
            <button
              type="submit"
              className="w-full rounded-lg bg-[#ffb84d] py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#f2c94c]"
            >
              Enter control center
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!stats) return null;
  const { revenue, users, funnel, engagement, retention } = stats;
  const last7Orders = revenue.daily.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="relative min-h-screen bg-[#0d0a16] text-[#f7f1e5]">
      {/* ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 80% -10%, rgba(255,184,77,0.06), transparent 60%), radial-gradient(50rem 30rem at 10% 110%, rgba(242,201,76,0.05), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* header */}
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ffb84d]/25 bg-[#ffb84d]/[0.08]">
              <BarChart3 className="h-5 w-5 text-[#ffb84d]" />
            </div>
            <div>
              <h1 className="font-[var(--stack-display)] text-lg font-medium leading-none">
                Jyotish <span className="text-[#ffb84d]">Control Center</span>
              </h1>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#71688a]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f2c94c] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f2c94c]" />
                </span>
                Live · updated {fmtTime(stats.generatedAt)} IST
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshTick((x) => x + 1)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#b4aac4] transition-colors hover:border-[#ffb84d]/40 hover:text-[#ffb84d]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#b4aac4] transition-colors hover:border-[#e0522e]/40 hover:text-[#e0522e]"
            >
              <LogOut className="h-3.5 w-3.5" /> Exit
            </button>
          </div>
        </header>

        {/* hero numerals */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <HeroNumeral label="Today's revenue" value={inr(revenue.todayInr)} sub="captured today, IST" accent />
            <HeroNumeral label="MRR proxy" value={inr(revenue.mrrProxyInr)} sub="trailing 30d revenue" />
            <HeroNumeral label="ARR proxy" value={inr(revenue.arrProxyInr)} sub="MRR × 12 · one-time packs" />
            <HeroNumeral label="All-time" value={inr(revenue.totalInr)} sub={`${revenue.daysLive} days live`} />
          </div>
        </div>

        {/* goal + kpis */}
        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <GoalBar todayInr={revenue.todayInr} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            <Kpi
              label="Last 7 days"
              value={inr(revenue.last7Inr)}
              sub={`${last7Orders} paid orders`}
              delta={deltas.week}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <Kpi
              label="Avg order"
              value={inr(revenue.avgOrderValue)}
              sub="revenue ÷ paid orders"
              icon={<Wallet className="h-4 w-4" />}
            />
            <Kpi
              label="Last 30 days"
              value={inr(revenue.last30Inr)}
              sub="gross captured"
              icon={<CircleDollarSign className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* revenue chart + packs */}
        <div className="mb-5 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Section title="Revenue by day — last 14" icon={<Activity className="h-3.5 w-3.5" />}>
              <RevenueChart daily={revenue.daily} />
            </Section>
          </div>
          <div className="lg:col-span-2">
            <Section title="Revenue by pack" icon={<Layers className="h-3.5 w-3.5" />}>
              <PackSplit byPack={revenue.byPack} />
            </Section>
          </div>
        </div>

        {/* users + funnel */}
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <Section title="Users" icon={<Users className="h-3.5 w-3.5" />}>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Total" value={num(users.total)} icon={<Users className="h-4 w-4" />} />
              <Kpi label="New today" value={num(users.newToday)} />
              <Kpi label="New 7d" value={num(users.new7d)} />
              <Kpi label="Signed up" value={num(users.signedUp)} />
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <Stat label="New 30 days" value={num(users.new30d)} />
                <Stat label="Paying users" value={num(users.payingUsers)} />
              </div>
              <div className="mt-4 sm:mt-0">
                <div className="mb-2 text-[11px] text-[#b4aac4]">Language split</div>
                <LangSplit lang={users.lang} />
              </div>
            </div>
          </Section>

          <Section title="Funnel" icon={<Sparkles className="h-3.5 w-3.5" />}>
            <Funnel funnel={funnel} />
            <div className="mt-3 flex gap-4 border-t border-white/[0.05] pt-3 text-[11px] text-[#71688a]">
              <span>
                details→paid{" "}
                <span className="text-[#f7f1e5]">{Math.round((funnel.paid / Math.max(1, funnel.withDetails)) * 100)}%</span>
              </span>
              <span>
                chat→paid{" "}
                <span className="text-[#f7f1e5]">{Math.round((funnel.paid / Math.max(1, funnel.withChat)) * 100)}%</span>
              </span>
            </div>
          </Section>
        </div>

        {/* engagement + retention + orders health */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Engagement" icon={<MessageSquareText className="h-3.5 w-3.5" />}>
            <Stat label="Questions asked" value={num(engagement.questionsTotal)} />
            <Stat label="Questions today" value={num(engagement.questionsToday)} />
            <Stat label="Questions last 7d" value={num(engagement.questions7d)} />
            <Stat label="Unique askers" value={num(engagement.askers)} />
            <Stat label="Avg per asker" value={engagement.avgQuestionsPerAsker.toFixed(1)} />
          </Section>

          <Section title="Retention" icon={<Repeat className="h-3.5 w-3.5" />}>
            <Stat label="Paying users" value={num(retention.payers)} />
            <Stat label="Repeat payers (2+)" value={num(retention.repeatPayers)} />
            <Stat label="Cross-day repeaters" value={num(retention.crossDayPayers)} />
            <Stat
              label="Repeat rate"
              value={`${Math.round((retention.repeatPayers / Math.max(1, retention.payers)) * 100)}%`}
            />
            <div className="mt-2 text-[10px] text-[#71688a]">Cross-day = paid on ≥2 distinct days</div>
          </Section>

          <Section title="Orders health" icon={<Activity className="h-3.5 w-3.5" />}>
            <Stat label="Paid" value={num(revenue.orderHealth.paid)} />
            <Stat label="Pending (created)" value={num(revenue.orderHealth.created)} />
            <Stat label="Failed" value={num(revenue.orderHealth.failed)} />
            <Stat label="Simulated (test)" value={num(revenue.orderHealth.simulated)} />
            <div className="mt-2 text-[10px] text-[#71688a]">Chat content is never shown here</div>
          </Section>
        </div>
      </div>
    </div>
  );
}
