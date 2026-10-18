"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";

import { loadKundli, loadReportCtx, getDeviceId } from "@/lib/storage";
import { isReportType, reportNamespace, type ReportFacts, type ReportSection, type ReportType } from "@/lib/report";
import { RASHI, NAKSHATRA, PLANET } from "@/lib/local-names";
import type { Locale } from "@/i18n/routing";

/**
 * The printable reading — its own page on purpose.
 *
 * Printing the app's own screen meant printing an interface: sticky bars, a
 * dark surface and a scrolling document. This is a fixed document template
 * instead — one column, real page margins, a masthead, a facts table and
 * widow/orphan control — so what comes out of "Save as PDF" looks like a
 * reading rather than a screenshot.
 *
 * It reads the report from the device (`ReportCtx`, written when the report was
 * unlocked), so the paper copy is the same text the buyer read, instantly, with
 * no second LLM run. Only if the device has nothing does it fetch.
 *
 * It prints itself once the content is laid out, then closes — the download is
 * one tap from the report, not a trip through the browser's print dialog.
 */
const subscribeNoop = () => () => {};

/** The report asked for, from the URL. Server snapshot matches the default so
    the first client render agrees with the server HTML. */
function requestedType(): ReportType {
  const raw = new URLSearchParams(window.location.search).get("type");
  return isReportType(raw) ? raw : "marriage";
}

export default function PrintReportPage() {
  const locale = useLocale() as Locale;
  // Career and baby sections live in their own namespaces, so the translator
  // has to follow the type — using "Report" for a career report silently
  // resolved to nothing and mislabelled the title as Marriage.
  const type = useSyncExternalStore(subscribeNoop, requestedType, () => "marriage" as ReportType);
  const t = useTranslations("Report");
  const tt = useTranslations(reportNamespace(type));
  const tc = useTranslations("Common");
  const [facts, setFacts] = useState<ReportFacts | null>(null);
  const [sections, setSections] = useState<ReportSection[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const printed = useRef(false);

  const rashi = (i: number) => RASHI[locale]?.[i] ?? RASHI.en[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA[locale]?.[i] ?? NAKSHATRA.en[i] ?? String(i);
  const planet = (id: string) => PLANET[locale]?.[id.toLowerCase()] ?? id;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 1. The report this device already holds — same text as the screen.
      const ctx = loadReportCtx();
      if (ctx && ctx.type === type && ctx.sections?.length) {
        if (cancelled) return;
        setFacts(ctx.facts);
        setSections(ctx.sections);
        setState("ready");
        return;
      }

      // 2. Otherwise ask the server (stored copy, or a fresh generation).
      const kundli = loadKundli();
      const profile = kundli?.profile;
      if (!profile) {
        if (!cancelled) setState("unavailable");
        return;
      }
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
          body: JSON.stringify({
            type,
            name: profile.name ?? "",
            date: profile.date,
            time: profile.time,
            place: profile.place,
            lat: profile.lat,
            lng: profile.lng,
            timezone: profile.timezone,
            gender: profile.gender,
            lang: locale,
            stage: "full",
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data.sections)) {
          setState("unavailable");
          return;
        }
        setFacts(data.facts as ReportFacts);
        setSections(data.sections as ReportSection[]);
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Print once the document is on the page and laid out.
  useEffect(() => {
    if (state !== "ready" || printed.current) return;
    printed.current = true;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [state]);

  // A tab opened by the download button closes itself; anything else is left
  // open, because closing a tab the reader opened themselves is rude.
  useEffect(() => {
    const done = () => {
      if (window.opener) window.close();
    };
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  if (state === "loading") {
    return <div className="print-page__status">{t("working")}</div>;
  }
  if (state === "unavailable" || !facts || !sections) {
    return <div className="print-page__status">{t("errGeneric")}</div>;
  }

  const profile = facts.profile;
  const generated = new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="print-page">
      <div className="print-page__bar">
        <button type="button" className="btn btn--gold btn--sm" onClick={() => window.print()}>
          {t("download")}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.close()}>
          {tc("close")}
        </button>
      </div>

      <article className="print-doc">
        <header className="print-doc__masthead">
          <span className="print-doc__brand">Jyotish · Vedic Astrology</span>
          <h1 className="print-doc__title">{tt("docTitle")}</h1>
          <p className="print-doc__prepared">
            {profile.name ? `${profile.name} · ` : ""}
            {profile.date} · {profile.time}
            {profile.place ? ` · ${profile.place}` : ""}
          </p>
        </header>

        <section className="print-doc__facts">
          <h2 className="print-doc__h2">{tc("printFactsTitle")}</h2>
          <dl className="print-doc__facts-list">
            <div>
              <dt>{t("lagna")}</dt>
              <dd>{rashi(facts.lagna)}</dd>
            </div>
            <div>
              <dt>{t("moonSign")}</dt>
              <dd>{rashi(facts.moonRashi)}</dd>
            </div>
            <div>
              <dt>{t("nakshatra")}</dt>
              <dd>
                {nak(facts.moonNakshatra)} · {t("pada")} {facts.moonNakshatraPad}
              </dd>
            </div>
            <div>
              <dt>{t("currentDasha")}</dt>
              <dd>{planet(facts.currentDashaLord)}</dd>
            </div>
          </dl>
        </section>

        {sections.map((s) => (
          <section key={s.id} className="print-doc__section">
            <h2 className="print-doc__h2">{tt(`sections.${s.id}`)}</h2>
            {s.body
              .split(/\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="print-doc__p">
                  {p}
                </p>
              ))}
          </section>
        ))}

        <footer className="print-doc__footer">
          <p>{tt("disclaimer")}</p>
          <p className="print-doc__meta">
            {tc("generatedOn")} {generated} · hiarya.in
          </p>
        </footer>
      </article>
    </div>
  );
}
