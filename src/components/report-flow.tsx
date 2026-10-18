"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDeviceId, saveReportCtx } from "@/lib/storage";
import { formatPrice, isCurrency, type Currency } from "@/lib/money";
import { RASHI, NAKSHATRA, PLANET } from "@/lib/local-names";
import {
  reportPackId,
  REPORT_SECTIONS,
  type ReportFacts,
  type ReportSection,
  type ReportType,
} from "@/lib/report";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import { ArrowRight, CalendarDays, Clock, Loader2, Lock, Download, MessageCircle } from "lucide-react";
import { GenderField } from "./gender-field";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Gender } from "@/lib/types";
import posthog from "posthog-js";

function capturePostHog(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
    posthog.capture(event, properties);
  }
}

/** The i18n namespace holding a report's own copy (title, sections, disclaimer). */
export function reportNamespace(type: ReportType): string {
  return type === "career" ? "CareerReport" : type === "child" ? "BabyReport" : "Report";
}

/** Loads Razorpay checkout and opens the payment sheet. Same pattern (and the
 *  same /api/payment-verify settling endpoint) as the chat paywall. */
function openRazorpay(opts: {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  description: string;
  prefillName?: string;
}): Promise<{ ok: boolean; opened: boolean }> {
  return new Promise((resolve) => {
    let opened = false;
    const settle = (ok: boolean) => resolve({ ok, opened });
    const loadScript = () => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) return init();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = init;
      s.onerror = () => settle(false);
      document.head.appendChild(s);
    };
    const init = () => {
      const R = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void } }).Razorpay;
      if (!R) return settle(false);
      const rzp = new R({
        key: opts.keyId,
        amount: opts.amount,
        currency: opts.currency,
        name: "Jyotish",
        description: opts.description,
        order_id: opts.orderId,
        prefill: opts.prefillName ? { name: opts.prefillName } : undefined,
        remember_customer: true,
        retry: { enabled: true },
        modal: { ondismiss: () => settle(false), confirm_close: true },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const res = await fetch("/api/payment-verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-device-id": getDeviceId(),
              },
              body: JSON.stringify(response),
            });
            settle(res.ok);
          } catch {
            settle(false);
          }
        },
      });
      opened = true;
      rzp.open();
    };
    loadScript();
  });
}

type Step = "form" | "teaser" | "full";

/**
 * The shared paid-report flow. One component drives marriage, career & money,
 * and baby/child — the `type` picks the price, pack id, section set and teaser;
 * everything else (birth form, checkout, print-to-PDF doc, chat hand-off) is
 * identical. Copy comes from the type's i18n namespace plus the shared "Report"
 * labels.
 */
export function ReportFlow({ type = "marriage" }: { type?: ReportType }) {
  const ns = reportNamespace(type);
  const t = useTranslations(ns);
  const tr = useTranslations("Report");
  const locale = useLocale() as Locale;

  const sectionIds = REPORT_SECTIONS[type];

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selected, setSelected] = useState<PlaceSelection | null>(null);

  const [facts, setFacts] = useState<ReportFacts | null>(null);
  const [sections, setSections] = useState<ReportSection[] | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [purchased, setPurchased] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const checkoutBusyRef = useRef(false);

  const effectiveTime = time || "12:00";
  const canSubmit = Boolean(name.trim()) && Boolean(date) && Boolean(selected) && !busy;

  const rashi = (i: number) => RASHI[locale]?.[i] ?? RASHI.en[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA[locale]?.[i] ?? NAKSHATRA.en[i] ?? String(i);
  const planet = (id: string) => PLANET[locale]?.[id.toLowerCase()] ?? id;

  function birthPayload() {
    return {
      type,
      name: name.trim(),
      date,
      time: effectiveTime,
      place: selected?.place ?? "",
      lat: selected?.lat ?? 0,
      lng: selected?.lng ?? 0,
      timezone: selected?.timezone ?? "",
      lang: locale,
      gender: gender || undefined,
    };
  }

  /** Step 1: compute the chart and show the free teaser. */
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ ...birthPayload(), stage: "teaser" }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("report_failed", data);
        throw new Error(tr("errGeneric"));
      }
      setFacts(data.facts as ReportFacts);
      setPrice(typeof data.price === "number" ? data.price : null);
      setCurrency(isCurrency(data.currency) ? data.currency : "INR");
      setPurchased(Boolean(data.purchased));
      setStep("teaser");
      capturePostHog("report_teaser_viewed", { type });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(tr("errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  /** Step 3 (after payment): fetch the full report. */
  async function loadFull() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ ...birthPayload(), stage: "full" }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("report_failed", data);
        throw new Error(tr("errGeneric"));
      }
      const nextFacts = data.facts as ReportFacts;
      const nextSections = data.sections as ReportSection[];
      setFacts(nextFacts);
      setSections(nextSections);
      setStep("full");
      // Hold the report on-device so the chat can answer follow-ups from it.
      // The DB row is written only on download (see persistDownload).
      saveReportCtx({
        type,
        packId: reportPackId(type, currency),
        generatedAt: new Date().toISOString(),
        facts: nextFacts,
        sections: nextSections,
      });
      capturePostHog("report_purchased", { type, price: price ?? 0, currency });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setNote(tr("errPay"));
    } finally {
      setBusy(false);
    }
  }

  /** Step 2: buy (or, if already owned, just open). */
  async function unlock() {
    if (checkoutBusyRef.current) return;
    checkoutBusyRef.current = true;

    if (purchased) {
      await loadFull();
      checkoutBusyRef.current = false;
      return;
    }

    setBusy(true);
    setNote("");
    capturePostHog("report_checkout_started", { type, price: price ?? 0, currency });
    try {
      const res = await fetch("/api/report-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("report_failed", data);
        throw new Error(tr("errGeneric"));
      }

      if (data.simulated) {
        await loadFull();
        return;
      }

      const result = await openRazorpay({
        orderId: data.orderId,
        keyId: data.keyId,
        amount: data.amount,
        currency: data.currency,
        description: t("productName"),
        prefillName: name.trim() || undefined,
      });
      if (result.ok) {
        await loadFull();
      } else {
        setNote(result.opened ? tr("payDismissed") : tr("payScriptFailed"));
      }
    } catch {
      setNote(tr("errPay"));
    } finally {
      checkoutBusyRef.current = false;
      setBusy(false);
    }
  }

  /** Persist the report once the buyer downloads — never on mere viewing. */
  function persistDownload() {
    if (!sections) return;
    void fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getDeviceId(),
      },
      body: JSON.stringify({ ...birthPayload(), stage: "download", sections }),
    }).catch(() => {});
  }

  const priceLabel = price != null ? formatPrice(price, currency) : "₹199";

  /* ── Step 1: birth details ──────────────────────────────────────────── */
  if (step === "form") {
    return (
      <div className="no-print">
        <form className="details-form" onSubmit={submitForm}>
          <label className="field">
            <span className="field__label">{tr("name")}</span>
            <input
              className="field__input"
              type="text"
              data-exclude="true"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("namePh")}
            />
          </label>

<GenderField value={gender} onChange={setGender} />

          <div className="details-form__row">
            <label className="field">
              <span className="field__label">{tr("dob")}</span>
              <span className="field__control">
                <CalendarDays size={18} className="field__icon" aria-hidden="true" />
                <input
                className="field__input field__input--icon"
                type="date"
                data-exclude="true"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">{tr("tob")}</span>
              <span className="field__control">
                <Clock size={18} className="field__icon" aria-hidden="true" />
                <input
                className="field__input field__input--icon"
                type="time"
                data-exclude="true"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                />
              </span>
            </label>
          </div>
          {!time && (
            <p className="faint" style={{ fontSize: 12, marginTop: -8 }}>
              {tr("unknownTime")}
            </p>
          )}

          <PlaceAutocomplete
            label={tr("pob")}
            placeholder={tr("pobPh")}
            onSelect={setSelected}
            onEdit={() => setSelected(null)}
          />

          {error && <p role="alert" style={{ color: "var(--error-text)", fontSize: 13 }}>{error}</p>}

          <button type="submit" className="btn btn--gold" disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> {tr("building")}
              </>
            ) : (
              <>
                {t("ctaBuild")} <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="faint" style={{ fontSize: 12.5, textAlign: "center" }}>
            {tr("freeNote")}
          </p>
        </form>
      </div>
    );
  }

  /* ── Step 3: full report ────────────────────────────────────────────── */
  if (step === "full" && facts && sections) {
    return (
      <>
        <div className="no-print rpt-paybar">
          <button
            className="btn btn--gold"
            onClick={() => {
              persistDownload();
              window.print();
            }}
          >
            <Download size={17} /> {tr("download")}
          </button>
          <Link className="btn btn--ghost" href="/chat">
            <MessageCircle size={17} /> {tr("discussWithArya")}
          </Link>
          <span className="faint" style={{ fontSize: 12.5 }}>
            {tr("downloadHint")}
          </span>
          {note && <span role="alert" style={{ color: "var(--error-text)", fontSize: 13 }}>{note}</span>}
        </div>

        <article className="rpt-doc" lang={locale}>
          <header className="rpt-masthead">
            <h2 className="rpt-title">{t("docTitle")}</h2>
            <p className="rpt-sub">
              {facts.profile.name ? `${facts.profile.name} · ` : ""}
              {facts.profile.date} · {facts.profile.time}
              {facts.profile.place ? ` · ${facts.profile.place}` : ""}
            </p>
            <div className="rpt-rule" />
          </header>

          <dl className="rpt-facts">
            <Fact label={tr("lagna")} value={rashi(facts.lagna)} />
            <Fact label={tr("moonSign")} value={rashi(facts.moonRashi)} />
            <Fact
              label={tr("nakshatra")}
              value={`${nak(facts.moonNakshatra)} · ${tr("pada")} ${facts.moonNakshatraPad}`}
            />
            <Fact label={tr("currentDasha")} value={planet(facts.currentDashaLord)} />
          </dl>

          {sections.map((s) => (
            <section key={s.id} className="rpt-section">
              <h3 className="rpt-section__title">{t(`sections.${s.id}`)}</h3>
              {s.body
                .split(/\n+/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i} className="rpt-p">
                    {p}
                  </p>
                ))}
            </section>
          ))}

          <footer className="rpt-footer">{t("disclaimer")}</footer>
        </article>
      </>
    );
  }

  /* ── Step 2: teaser + paywall ───────────────────────────────────────── */
  if (!facts) return null;

  return (
    <div className="no-print rpt-teaser">
      <dl className="rpt-facts">
        <Fact label={tr("lagna")} value={rashi(facts.lagna)} />
        <Fact label={tr("moonSign")} value={rashi(facts.moonRashi)} />
        <Fact
          label={tr("nakshatra")}
          value={`${nak(facts.moonNakshatra)} · ${tr("pada")} ${facts.moonNakshatraPad}`}
        />
        <Fact label={tr("currentDasha")} value={planet(facts.currentDashaLord)} />
      </dl>

      {type === "career" && <CareerTeaser facts={facts} />}
      {type === "child" && <ChildTeaser facts={facts} locale={locale} />}
      {type === "marriage" && <MarriageTeaser facts={facts} />}

      {/* The paid report as a table of contents — what you are buying, named. */}
      <section className="rpt-contents">
        <h2 className="rpt-contents__title">
          <Lock size={15} aria-hidden /> {tr("lockedTitle")}
        </h2>
        <p className="rpt-note">{tr("lockedNote")}</p>
        <ul className="rpt-contents__list">
          {sectionIds.map((id) => (
            <li key={id}>
              <Lock size={13} aria-hidden /> {t(`sections.${id}`)}
            </li>
          ))}
        </ul>
      </section>

      {facts.profile.place && <p className="rpt-note">{tr("calcNote")}</p>}

      {note && <p role="alert" className="rpt-error">{note}</p>}

      <div className="rpt-dock">
        <button className="btn btn--gold" onClick={unlock} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={18} className="spin" /> {tr("working")}
            </>
          ) : purchased ? (
            <>{tr("viewReport")}</>
          ) : (
            <>{tr("unlockFor")}</>
          )}
        </button>
        {!purchased && (
          <p className="rpt-note">
            {priceLabel} · {tr("oneTime")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Per-type teaser groups ───────────────────────────────────────────── */

function MarriageTeaser({ facts }: { facts: ReportFacts }) {
  const t = useTranslations("Report");
  const locale = useLocale() as Locale;
  const rashi = (i: number) => RASHI[locale]?.[i] ?? RASHI.en[i] ?? String(i);
  const planet = (id: string) => PLANET[locale]?.[id.toLowerCase()] ?? id;
  const doshaLabel =
    facts.mangalDosha === true
      ? t("doshaPresent")
      : facts.mangalDosha === "mild"
        ? t("doshaMild")
        : t("doshaNone");

  return (
    <>
      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("marriageHouse")}</h3>
        <dl className="rpt-facts">
          <Fact label={t("seventhSign")} value={rashi(facts.seventhSign)} />
          <Fact
            label={t("seventhLord")}
            value={`${planet(facts.seventhLord)} \u00b7 ${t("house")} ${facts.seventhLordHouse}`}
          />
          <Fact
            label={t("planetsInSeventh")}
            value={
              facts.planetsInSeventh.length
                ? facts.planetsInSeventh.map(planet).join(", ")
                : t("none")
            }
          />
        </dl>
      </section>

      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("karakas")}</h3>
        <dl className="rpt-facts">
          <Fact
            label={t("venusIn")}
            value={`${rashi(facts.venusSign)} \u00b7 ${t("house")} ${facts.venusHouse}`}
          />
          <Fact
            label={t("jupiterIn")}
            value={`${rashi(facts.jupiterSign)} \u00b7 ${t("house")} ${facts.jupiterHouse}`}
          />
          <Fact label={t("mangalDosha")} value={doshaLabel} />
        </dl>
      </section>
    </>
  );
}

function CareerTeaser({ facts }: { facts: ReportFacts }) {
  const t = useTranslations("CareerReport");
  const tr = useTranslations("Report");
  const locale = useLocale() as Locale;
  const rashi = (i: number) => RASHI[locale]?.[i] ?? RASHI.en[i] ?? String(i);
  const planet = (id: string) => PLANET[locale]?.[id.toLowerCase()] ?? id;

  return (
    <>
      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("careerHouse")}</h3>
        <dl className="rpt-facts">
          <Fact label={t("tenthSign")} value={rashi(facts.tenthSign)} />
          <Fact
            label={t("tenthLord")}
            value={`${planet(facts.tenthLord)} \u00b7 ${tr("house")} ${facts.tenthLordHouse}`}
          />
          <Fact
            label={t("planetsInTenth")}
            value={
              facts.planetsInTenth.length
                ? facts.planetsInTenth.map(planet).join(", ")
                : tr("none")
            }
          />
        </dl>
      </section>

      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("wealthGains")}</h3>
        <dl className="rpt-facts">
          <Fact
            label={t("secondLord")}
            value={`${planet(facts.secondLord)} \u00b7 ${tr("house")} ${facts.secondLordHouse}`}
          />
          <Fact
            label={t("eleventhLord")}
            value={`${planet(facts.eleventhLord)} \u00b7 ${tr("house")} ${facts.eleventhLordHouse}`}
          />
          <Fact
            label={t("mercuryIn")}
            value={`${rashi(
              facts.planets.find((p) => p.id === "mercury")?.rashi ?? 0
            )} \u00b7 ${tr("house")} ${facts.mercuryHouse}`}
          />
        </dl>
      </section>
    </>
  );
}

function ChildTeaser({ facts, locale }: { facts: ReportFacts; locale: Locale }) {
  const t = useTranslations("BabyReport");
  const tr = useTranslations("Report");
  const rashi = (i: number) => RASHI[locale]?.[i] ?? RASHI.en[i] ?? String(i);
  const nak = (i: number) => NAKSHATRA[locale]?.[i] ?? NAKSHATRA.en[i] ?? String(i);
  const planet = (id: string) => PLANET[locale]?.[id.toLowerCase()] ?? id;
  const devanagari = locale !== "en";

  return (
    <>
      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("namingCard")}</h3>
        <dl className="rpt-facts">
          <Fact
            label={t("nakshatraPada")}
            value={`${nak(facts.moonNakshatra)} \u00b7 ${tr("pada")} ${facts.moonNakshatraPad}`}
          />
          <Fact
            label={t("namingLetters")}
            value={facts.namingSyllables
              .map((s) => (devanagari ? s.dev : s.rom))
              .join(" \u00b7 ")}
          />
          <Fact
            label={t("namingLetter")}
            value={devanagari ? facts.namingLetter.dev : facts.namingLetter.rom}
            lead
          />
        </dl>
      </section>

      <section className="rpt-group">
        <h3 className="rpt-group__title">{t("mindLearning")}</h3>
        <dl className="rpt-facts">
          <Fact label={tr("moonSign")} value={rashi(facts.moonRashi)} />
          <Fact
            label={t("fifthLord")}
            value={`${planet(facts.fifthLord)} \u00b7 ${tr("house")} ${facts.fifthLordHouse}`}
          />
          <Fact
            label={t("jupiterIn")}
            value={`${rashi(facts.jupiterSign)} \u00b7 ${tr("house")} ${facts.jupiterHouse}`}
          />
        </dl>
      </section>
    </>
  );
}

function Fact({
  label,
  value,
  lead,
}: {
  label: string;
  value: string;
  lead?: boolean;
}) {
  return (
    <div className="rpt-facts__row">
      <dt>{label}</dt>
      <dd className={lead ? "rpt-facts__value rpt-facts__value--lead" : "rpt-facts__value"}>
        {value}
      </dd>
    </div>
  );
}
