"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { loadKundli, getDeviceId } from "@/lib/storage";
import { PLANET, RASHI } from "@/lib/local-names";
import { glyphFor } from "@/lib/glyphs";
import type { Locale } from "@/i18n/routing";
import type { TransitPosition } from "@/lib/transit";
import type { UpcomingEvent } from "@/lib/today";
import { NavagrahaMandala } from "@/components/navagraha-mandala";
import { AppNav } from "@/components/app-nav";
import {
  Sparkles, Briefcase, Heart, Coins, HeartPulse, Clock,
  RefreshCw, MessageCircle, ArrowLeft, CalendarDays,
} from "lucide-react";

interface DailySummary {
  overall: string;
  career: string;
  love: string;
  money: string;
  health: string;
  insight: string;
  luckyTime: string;
}

interface TodayData {
  date: string;
  meta: { weekdayId: number; rulerId: string; luckyColor: string };
  luckyTime: string;
  summary: DailySummary;
  influences: TransitPosition[];
  upcoming: UpcomingEvent[];
}

const CACHE_KEY = "jyotish_today_v1";

function readCache(locale: string): TodayData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.date === new Date().toISOString().slice(0, 10) && c.lang === locale && c.data) {
      return c.data as TodayData;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function TodayPage() {
  const t = useTranslations("Today");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const kundli = useKundli();

  const [data, setData] = useState<TodayData | null>(() => readCache(locale));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const planet = PLANET[locale];
  const rashi = RASHI[locale];

  const generate = useCallback(async () => {
    if (!kundli) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ kundli, lang: locale }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to generate");
      setData(json as TodayData);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ date: json.date, lang: locale, data: json })
      );
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [kundli, locale]);

  useEffect(() => {
    if (!loadKundli()) {
      router.replace("/details");
    }
  }, [router]);

  useEffect(() => {
    if (data) return;
    const timer = setTimeout(() => void generate(), 0);
    return () => clearTimeout(timer);
  }, [data, generate]);

  if (!kundli) {
    return (
      <div className="screen" style={{ paddingTop: 40, textAlign: "center" }}>
        <span className="faint">…</span>
      </div>
    );
  }

  const weekday = data
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const mini = [
    { key: "career", title: t("career"), icon: Briefcase },
    { key: "love", title: t("love"), icon: Heart },
    { key: "money", title: t("money"), icon: Coins },
    { key: "health", title: t("health"), icon: HeartPulse },
  ] as const;

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 0 10px" }}>
        <button className="faint" style={{ fontSize: 22 }} onClick={() => router.push("/kundli")} aria-label="back">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--stack-display)", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
            {t("title")}
          </h1>
          <p className="faint" style={{ fontSize: 12 }}>{t("subtitle")}</p>
        </div>
      </div>

      {loading && !data && (
        <div className="reading-loading">
          <NavagrahaMandala />
          <p className="muted">{t("generating")}</p>
        </div>
      )}

      {error && !data && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ color: "#ff8f8f", fontSize: 14 }}>{error}</p>
          <button className="btn btn--gold" onClick={generate} style={{ marginTop: 14 }}>
            <RefreshCw size={16} /> {t("generating")}
          </button>
        </div>
      )}

      {data && (
        <>
          {/* header strip */}
          <div className="today-hero card card--gold-edge">
            <div>
              <p className="today-hero__weekday">{weekday}</p>
              <p className="today-hero__ruler">
                {t("ruler")}: {planet[data.meta.rulerId] ?? data.meta.rulerId}
              </p>
            </div>
            <div className="today-hero__lucky">
              <span className="today-lucky-row">
                <span className="today-color-dot" style={{ background: data.meta.luckyColor }} />
                <span>
                  <span className="today-label">{t("luckyColor")}</span>
                  <span className="today-value">{data.luckyTime}</span>
                </span>
              </span>
            </div>
          </div>

          {/* energy */}
          <article className="reading-card today-energy">
            <span className="reading-card__icon"><Sparkles size={20} /></span>
            <div className="reading-card__body">
              <h2 className="reading-card__title">{t("energy")}</h2>
              <p className="reading-card__text">{data.summary.overall}</p>
            </div>
          </article>

          {/* mini areas */}
          <div className="today-grid">
            {mini.map(({ key, title, icon: Icon }) => (
              <article className="today-mini" key={key}>
                <span className="today-mini__icon"><Icon size={17} /></span>
                <h3 className="today-mini__title">{title}</h3>
                <p className="today-mini__text">{data.summary[key]}</p>
              </article>
            ))}
          </div>

          {/* insight */}
          <article className="reading-card">
            <span className="reading-card__icon"><Clock size={20} /></span>
            <div className="reading-card__body">
              <h2 className="reading-card__title">{t("insight")}</h2>
              <p className="reading-card__text">{data.summary.insight}</p>
            </div>
          </article>

          {/* influences */}
          <section style={{ paddingTop: 22 }}>
            <h2 className="section-title">{t("influences")}</h2>
            <div className="today-list">
              {data.influences.map((p) => (
                <div className="today-list__row" key={p.id}>
                  <span className="chart-legend__glyph astro-glyph" style={{ color: "#f2c94c" }}>
                    {glyphFor(p.id, p.symbol)}
                  </span>
                  <span className="today-list__name">{planet[p.id] ?? p.name}</span>
                  <span className="today-list__val">{rashi[p.rashi]} · {p.house}{p.house === 1 ? "st" : p.house === 2 ? "nd" : p.house === 3 ? "rd" : "th"} house</span>
                </div>
              ))}
            </div>
          </section>

          {/* upcoming */}
          <section style={{ paddingTop: 22 }}>
            <h2 className="section-title">{t("upcoming")}</h2>
            {data.upcoming.length === 0 ? (
              <p className="faint" style={{ fontSize: 13 }}>{t("noUpcoming")}</p>
            ) : (
              <div className="today-list">
                {data.upcoming.map((e, i) => (
                  <div className="today-list__row" key={i}>
                    <span className="today-mini__icon" style={{ background: "transparent", borderColor: "var(--line)" }}>
                      <CalendarDays size={16} />
                    </span>
                    <span className="today-list__name">
                      {e.type === "ingress"
                        ? `${planet[e.planetId] ?? e.planetId} → ${rashi[e.sign ?? 0]}`
                        : `${planet[e.planetId] ?? e.planetId} ✦ ${planet[e.natalId ?? ""] ?? e.natalId}`}
                    </span>
                    <span className="today-list__val">
                      {new Date(`${e.date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div style={{ paddingTop: 24, display: "grid", gap: 10 }}>
            <button className="btn btn--gold btn--lg" onClick={() => router.push("/chat")}>
              <MessageCircle size={18} /> {t("ask")}
            </button>
            <button className="btn btn--ghost" onClick={generate} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </>
      )}

      <AppNav />
    </div>
  );
}