"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { loadKundli, getDeviceId } from "@/lib/storage";
import { NavagrahaMandala } from "@/components/navagraha-mandala";
import { AppNav } from "@/components/app-nav";
import {
  Sparkles, Briefcase, HeartHandshake, Coins, HeartPulse,
  RefreshCw, MessageCircle, ArrowLeft,
} from "lucide-react";

type Overview = {
  personality: string;
  career: string;
  marriage: string;
  wealth: string;
  health: string;
};

const CACHE_KEY = "jyotish_overview_v1";

function readCache(locale: string): Overview | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (
      c.date === new Date().toISOString().slice(0, 10) &&
      c.lang === locale &&
      c.data
    ) {
      return c.data as Overview;
    }
  } catch {
    // ignore stale cache
  }
  return null;
}

export default function OverviewPage() {
  const t = useTranslations("Overview");
  const locale = useLocale();
  const router = useRouter();
  const kundli = useKundli();

  const [overview, setOverview] = useState<Overview | null>(() => readCache(locale));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    if (!kundli) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ kundli, lang: locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to generate");
      setOverview(data.overview as Overview);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          lang: locale,
          data: data.overview,
        })
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
    if (overview) return;
    const t = setTimeout(() => {
      void generate();
    }, 0);
    return () => clearTimeout(t);
  }, [overview, generate]);

  const sections = [
    { key: "personality", title: t("personality"), icon: Sparkles },
    { key: "career", title: t("career"), icon: Briefcase },
    { key: "marriage", title: t("marriage"), icon: HeartHandshake },
    { key: "wealth", title: t("wealth"), icon: Coins },
    { key: "health", title: t("health"), icon: HeartPulse },
  ] as const;

  if (!kundli) {
    return (
      <div className="screen" style={{ paddingTop: 40, textAlign: "center" }}>
        <span className="faint">…</span>
      </div>
    );
  }

  return (
    <div className="screen">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 0 10px",
        }}
      >
        <button
          className="faint"
          style={{ fontSize: 22 }}
          onClick={() => router.push("/kundli")}
          aria-label="back"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1
            style={{
              fontFamily: "var(--stack-display)",
              fontSize: 26,
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            {t("title")}
          </h1>
          <p className="faint" style={{ fontSize: 12 }}>
            {t("subtitle")}
          </p>
        </div>
      </div>

      {loading && !overview && (
        <div className="reading-loading">
          <NavagrahaMandala />
          <p className="muted">{t("generating")}</p>
        </div>
      )}

      {error && !overview && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ color: "#ff8f8f", fontSize: 14 }}>{error}</p>
          <button className="btn btn--gold" onClick={generate} style={{ marginTop: 14 }}>
            <RefreshCw size={16} /> {t("regenerate")}
          </button>
        </div>
      )}

      {overview && (
        <>
          <div className="reading-list">
            {sections.map(({ key, title, icon: Icon }) =>
              overview[key] ? (
                <article className="reading-card" key={key}>
                  <span className="reading-card__icon">
                    <Icon size={20} />
                  </span>
                  <div className="reading-card__body">
                    <h2 className="reading-card__title">{title}</h2>
                    <p className="reading-card__text">{overview[key]}</p>
                  </div>
                </article>
              ) : null
            )}
          </div>

          <div style={{ paddingTop: 22, display: "grid", gap: 10 }}>
            <button className="btn btn--gold btn--lg" onClick={() => router.push("/chat")}>
              <MessageCircle size={18} /> {t("ask")}
            </button>
            <button className="btn btn--ghost" onClick={generate} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} /> {t("regenerate")}
            </button>
          </div>
        </>
      )}

      <AppNav />
    </div>
  );
}