"use client";

import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { KundliChart } from "@/components/kundli-chart";
import { useKundli } from "@/hooks/use-kundli";
import { loadKundli } from "@/lib/storage";
import { NAKSHATRA, PLANET, RASHI } from "@/lib/local-names";
import { glyphFor } from "@/lib/glyphs";
import type { Locale } from "@/i18n/routing";
import { MessageCircle, RotateCcw, Sparkles, Sun, Orbit, Timer, ChevronRight } from "lucide-react";
import { TermInfo } from "@/components/term-info";
import { AccordionSection } from "@/components/acc-section";
import { ReadingInline } from "@/components/reading-inline";
import { TodayInline } from "@/components/today-inline";
import { AppNav } from "@/components/app-nav";

export default function KundliPage() {
  const t = useTranslations("Kundli");
  const ot = useTranslations("Overview");
  const dt = useTranslations("Today");
  const terms = useTranslations("Terms");
  const houses = terms.raw("houses") as unknown as string[];
  const dashaThemes = terms.raw("dashaThemes") as unknown as Record<string, string>;
  const locale = (useLocale() as Locale) ?? "en";
  const rashi = RASHI[locale];
  const nakshatra = NAKSHATRA[locale];
  const planet = PLANET[locale];
  const router = useRouter();
  const kundli = useKundli();

  useEffect(() => {
    if (!loadKundli()) {
      router.replace("/details");
    }
  }, [router]);

  if (!kundli) {
    return (
      <div className="screen" style={{ paddingTop: 40, textAlign: "center" }}>
        <span className="faint">…</span>
      </div>
    );
  }

  const c = kundli.computed;
  const currentDasha = kundli.dasha.periods.find((p) => p.current);

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
          onClick={() => router.back()}
          aria-label="back"
        >
          ‹
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

      <div className="chart-wrap">
        <KundliChart kundli={kundli} />
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <AccordionSection
          title={ot("title")}
          sub={ot("readingSub")}
          icon={<Sparkles size={20} />}
        >
          <ReadingInline />
        </AccordionSection>

        <AccordionSection
          title={dt("teaserTitle")}
          sub={dt("teaserSub")}
          icon={<Sun size={20} />}
          defaultOpen
        >
          <TodayInline />
        </AccordionSection>
      </div>

      <div className="kundli-grid">
        <div className="kundli-card">
          <TermInfo label={t("lagna")} tip={terms("lagna")} />
          <span className="kundli-card__value">{rashi[c.lagnaRashi]}</span>
        </div>
        <div className="kundli-card">
          <TermInfo label={t("rashi")} tip={terms("rashi")} />
          <span className="kundli-card__value">{rashi[c.moonRashi]}</span>
        </div>
        <div className="kundli-card">
          <TermInfo label={t("nakshatra")} tip={terms("nakshatra")} />
          <span className="kundli-card__value">
            {nakshatra[c.moonNakshatra]} · {c.moonNakshatraPad}
          </span>
        </div>
        <div className="kundli-card">
          <span className="kundli-card__label">{t("ayanamsa")}</span>
          <span className="kundli-card__value">{c.ayanamsa}°</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <AccordionSection title={t("planetTitle")} icon={<Orbit size={20} />}>
          <div className="planet-list">
            {kundli.planets.map((p) => {
              const key = p.id.toLowerCase();
              const theme = houses[p.house - 1] ?? "";
              const ord = p.house === 1 ? "st" : p.house === 2 ? "nd" : p.house === 3 ? "rd" : "th";
              return (
                <details className="planet-item" key={p.id}>
                  <summary className="planet-item__head">
                    <span className="glyph astro-glyph">{glyphFor(p.id, p.symbol)}</span>
                    <span className="planet-item__name">
                      {planet[key] ?? p.name}
                      {p.retrograde && <span className="faint" style={{ fontSize: 11 }}> ᴿ</span>}
                    </span>
                    <span className="planet-item__rashi">{rashi[p.rashi]}</span>
                    <span className="planet-item__deg">{p.degree}°</span>
                    <ChevronRight size={16} className="planet-item__chev" />
                  </summary>
                  <p className="planet-item__body">
                    {planet[key] ?? p.name} · {p.house}
                    {ord} {t("house")} — {theme}
                    {p.retrograde ? ` · ${terms("retrograde")}` : ""}
                  </p>
                </details>
              );
            })}
          </div>
        </AccordionSection>

        <AccordionSection title={t("dashaTitle")} icon={<Timer size={20} />}>
          <div className="dasha-list">
            {kundli.dasha.periods.map((p, i) => {
              const key = p.lord.toLowerCase();
              return (
                <div
                  key={i}
                  className={`dasha-item ${p.current ? "dasha-item--now" : ""}`}
                >
                  <span className="dasha-item__name">{planet[key] ?? p.lord}</span>
                  <span className="dasha-item__theme">{dashaThemes[key] ?? ""}</span>
                  {p.current && <span className="dasha-item__tag">{t("dashaNow")}</span>}
                  <span className="dasha-item__years">
                    {p.start} – {p.end}
                  </span>
                </div>
              );
            })}
          </div>
          {currentDasha && (
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              {t("asha")}: {planet[currentDasha.lord.toLowerCase()] ?? currentDasha.lord}
            </p>
          )}
        </AccordionSection>
      </div>

      <div style={{ paddingTop: 28, display: "grid", gap: 10 }}>
        <button
          className="btn btn--gold btn--lg"
          onClick={() => router.push("/chat")}
        >
          <MessageCircle size={18} /> {t("askCta")}
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => {
            localStorage.removeItem("jyotish_kundli_v1");
            router.push("/details");
          }}
        >
          <RotateCcw size={16} /> {t("regenerate")}
        </button>
      </div>

      <AppNav />
    </div>
  );
}