"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { getDeviceId, readDailyCache, writeDailyCache } from "@/lib/storage";
import { PLANET } from "@/lib/local-names";
import type { Locale } from "@/i18n/routing";
import type { TransitPosition } from "@/lib/transit";
import { RefreshCw, MessageCircle, Briefcase, Heart, Coins, HeartPulse } from "lucide-react";

const CACHE = "jyotish_today_v1";

interface TodayData {
  date: string;
  meta: { weekdayId: number; rulerId: string; luckyColor: string };
  luckyTime: string;
  summary: {
    overall: string;
    career: string;
    love: string;
    money: string;
    health: string;
    insight: string;
  };
  influences: TransitPosition[];
}

export function TodayInline() {
  const t = useTranslations("Today");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const kundli = useKundli();
  const planet = PLANET[locale];

  const [data, setData] = useState<TodayData | null>(() => readDailyCache<TodayData>(CACHE, locale));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setData(json as TodayData);
      writeDailyCache(CACHE, locale, json);
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [kundli, locale]);

  useEffect(() => {
    if (data) return;
    const timer = setTimeout(() => void generate(), 0);
    return () => clearTimeout(timer);
  }, [data, generate]);

  const mini = [
    { key: "career", title: t("career"), icon: Briefcase },
    { key: "love", title: t("love"), icon: Heart },
    { key: "money", title: t("money"), icon: Coins },
    { key: "health", title: t("health"), icon: HeartPulse },
  ] as const;

  if (loading && !data) {
    return <p className="faint" style={{ textAlign: "center", padding: "16px 0" }}>{t("generating")}</p>;
  }

  if (error && !data) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ color: "#ff8f8f", fontSize: 13 }}>{error}</p>
        <button className="btn btn--gold btn--sm" onClick={generate} style={{ marginTop: 10 }}>
          <RefreshCw size={14} /> {t("generating")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const weekday = new Date(`${data.date}T12:00:00`).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="inline-today">
      <div className="inline-today__top">
        <div>
          <p className="today-hero__weekday">{weekday}</p>
          <p className="today-hero__ruler">
            {t("ruler")}: {planet[data.meta.rulerId] ?? data.meta.rulerId}
          </p>
        </div>
        <div className="inline-today__lucky">
          <span className="today-color-dot" style={{ background: data.meta.luckyColor }} />
          <span>
            <span className="today-label">{t("luckyColor")}</span>
            <span className="today-value">{data.luckyTime}</span>
          </span>
        </div>
      </div>

      <p className="inline-today__energy">{data.summary.overall}</p>

      <div className="today-grid">
        {mini.map(({ key, title, icon: Icon }) => (
          <div className="today-mini" key={key}>
            <span className="today-mini__icon"><Icon size={16} /></span>
            <h3 className="today-mini__title">{title}</h3>
            <p className="today-mini__text">{data.summary[key]}</p>
          </div>
        ))}
      </div>

      <button className="btn btn--gold btn--sm" onClick={() => router.push("/chat")} style={{ marginTop: 6 }}>
        <MessageCircle size={15} /> {t("ask")}
      </button>
    </div>
  );
}
