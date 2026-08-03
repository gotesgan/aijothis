"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { getDeviceId, readDailyCache, writeDailyCache } from "@/lib/storage";
import {
  Sparkles, Briefcase, HeartHandshake, Coins, HeartPulse,
  RefreshCw, MessageCircle,
} from "lucide-react";

const CACHE = "jyotish_overview_v1";

type Overview = {
  personality: string;
  career: string;
  marriage: string;
  wealth: string;
  health: string;
};

export function ReadingInline() {
  const t = useTranslations("Overview");
  const locale = useLocale();
  const router = useRouter();
  const kundli = useKundli();

  const [data, setData] = useState<Overview | null>(() => readDailyCache<Overview>(CACHE, locale));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    if (!kundli) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ kundli, lang: locale }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setData(json.overview as Overview);
      writeDailyCache(CACHE, locale, json.overview);
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

  const sections = [
    { key: "personality", title: t("personality"), icon: Sparkles },
    { key: "career", title: t("career"), icon: Briefcase },
    { key: "marriage", title: t("marriage"), icon: HeartHandshake },
    { key: "wealth", title: t("wealth"), icon: Coins },
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
          <RefreshCw size={14} /> {t("regenerate")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="inline-reading">
      {sections.map(({ key, title, icon: Icon }) =>
        data[key] ? (
          <div className="inline-reading__row" key={key}>
            <span className="inline-reading__icon"><Icon size={16} /></span>
            <div className="inline-reading__body">
              <h3 className="inline-reading__title">{title}</h3>
              <p className="inline-reading__text">{data[key]}</p>
            </div>
          </div>
        ) : null
      )}
      <button className="btn btn--gold btn--sm" onClick={() => router.push("/chat")} style={{ marginTop: 12 }}>
        <MessageCircle size={15} /> {t("ask")}
      </button>
    </div>
  );
}
