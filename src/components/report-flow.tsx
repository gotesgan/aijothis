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
import { ArrowRight, Loader2, Lock, Download, Sparkles, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
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
      if (!res.ok) throw new Error(data.message ?? tr("errGeneric"));
      setFacts(data.facts as ReportFacts);
      setPrice(typeof data.price === "number" ? data.price : null);
      setCurrency(isCurrency(data.currency) ? data.currency : "INR");
      setPurchased(Boolean(data.purchased));
      setStep("teaser");
      capturePostHog("report_teaser_viewed", { type });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message || tr("errGeneric"));
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
      if (!res.ok) throw new Error(data.message ?? tr("errGeneric"));
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
      setNote((err as Error).message || tr("errPay"));
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
      if (!res.ok) throw new Error(data.message ?? tr("errGeneric"));

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

          <div className="details-form__row">
            <label className="field">
              <span className="field__label">{tr("dob")}</span>
              <input
                className="field__input"
                type="date"
                data-exclude="true"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{tr("tob")}</span>
              <input
                className="field__input"
                type="time"
                data-exclude="true"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
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

          {error && <p style={{ color: "#ff8f8f", fontSize: 13 }}>{error}</p>}

          <button type="submit" className="btn btn--gold btn--lg" disabled={!canSubmit}>
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
          {note && <span style={{ color: "#ff8f8f", fontSize: 13 }}>{note}</span>}
        </div>

        <article className="rpt-doc" lang={locale}>
          <header className="rpt-head">
            <div className="rpt-eyebrow">{t("docEyebrow")}</div>
            <h1 className="rpt-h1">{t("docTitle")}</h1>
            <p className="rpt-sub">
              {facts.profile.name ? `${facts.profile.name} · ` : ""}
              {facts.profile.date} · {facts.profile.time}
              {facts.profile.place ? ` · ${facts.profile.place}` : ""}
            </p>
            <div className="rpt-rule" />
          </header>

          <div className="rpt-meta-grid">
            <Meta label={tr("lagna")} value={rashi(facts.lagna)} />
            <Meta label={tr("moonSign")} value={rashi(facts.moonRashi)} />
            <Meta
              label={tr("nakshatra")}
              value={`${nak(facts.moonNakshatra)} · ${tr("pada")} ${facts.moonNakshatraPad}`}
            />
            <Meta
              label={tr("currentDasha")}
              value={planet(facts.currentDashaLord)}
            />
          </div>

          {sections.map((s) => (
            <section key={s.id} className="rpt-section">
              <h2 className="rpt-h2">{t(`sections.${s.id}`)}</h2>
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
      <div className="rpt-meta-grid">
        <Meta label={tr("lagna")} value={rashi(facts.lagna)} />
        <Meta label={tr("moonSign")} value={rashi(facts.moonRashi)} />
        <Meta
          label={tr("nakshatra")}
          value={`${nak(facts.moonNakshatra)} · ${tr("pada")} ${facts.moonNakshatraPad}`}
        />
        <Meta label={tr("currentDasha")} value={planet(facts.currentDashaLord)} />
      </div>

      {type === "career" && <CareerTeaser facts={facts} />}
      {type === "child" && <ChildTeaser facts={facts} locale={locale} />}
      {type === "marriage" && <MarriageTeaser facts={facts} />}

      <section className="rpt-card rpt-card--lock">
        <h2 className="rpt-h2">
          <Lock size={15} aria-hidden /> {tr("lockedTitle")}
        </h2>
        <p className="faint" style={{ fontSize: 13, marginTop: -6 }}>
          {tr("lockedNote")}
        </p>
        <ul className="rpt-locklist">
          {sectionIds.map((id) => (
            <li key={id}>
              <Lock size={13} aria-hidden /> {t(`sections.${id}`)}
            </li>
          ))}
        </ul>
      </section>

      {facts.profile.place && (
        <p className="faint" style={{ fontSize: 11.5, textAlign: "center", lineHeight: 1.5 }}>
          {tr("calcNote")}
        </p>
      )}

      <div className="rpt-cta">
        <button className="btn btn--gold btn--lg btn--block" onClick={unlock} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={18} className="spin" /> {tr("working")}
            </>
          ) : purchased ? (
            <>
              <Sparkles size={18} /> {tr("viewReport")}
            </>
          ) : (
            <>
              <Sparkles size={18} /> {tr("unlockFor")} {priceLabel}
            </>
          )}
        </button>
        {!purchased && (
          <p className="faint" style={{ fontSize: 12, textAlign: "center" }}>
            {tr("oneTime")}
          </p>
        )}
        {note && (
          <p style={{ color: "#ff8f8f", fontSize: 13, textAlign: "center" }}>{note}</p>
        )}
      </div>
    </div>
  );
}

/* ── Per-type teaser cards ────────────────────────────────────────────── */

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
      <section className="rpt-card">
        <h2 className="rpt-h2">{t("marriageHouse")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{t("seventhSign")}</dt>
            <dd>{rashi(facts.seventhSign)}</dd>
          </div>
          <div>
            <dt>{t("seventhLord")}</dt>
            <dd>
              {planet(facts.seventhLord)} · {t("house")} {facts.seventhLordHouse}
            </dd>
          </div>
          <div>
            <dt>{t("planetsInSeventh")}</dt>
            <dd>
              {facts.planetsInSeventh.length
                ? facts.planetsInSeventh.map(planet).join(", ")
                : t("none")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rpt-card">
        <h2 className="rpt-h2">{t("karakas")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{t("venusIn")}</dt>
            <dd>
              {rashi(facts.venusSign)} · {t("house")} {facts.venusHouse}
            </dd>
          </div>
          <div>
            <dt>{t("jupiterIn")}</dt>
            <dd>
              {rashi(facts.jupiterSign)} · {t("house")} {facts.jupiterHouse}
            </dd>
          </div>
          <div>
            <dt>{t("mangalDosha")}</dt>
            <dd>{doshaLabel}</dd>
          </div>
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
      <section className="rpt-card">
        <h2 className="rpt-h2">{t("careerHouse")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{t("tenthSign")}</dt>
            <dd>{rashi(facts.tenthSign)}</dd>
          </div>
          <div>
            <dt>{t("tenthLord")}</dt>
            <dd>
              {planet(facts.tenthLord)} · {tr("house")} {facts.tenthLordHouse}
            </dd>
          </div>
          <div>
            <dt>{t("planetsInTenth")}</dt>
            <dd>
              {facts.planetsInTenth.length
                ? facts.planetsInTenth.map(planet).join(", ")
                : tr("none")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rpt-card">
        <h2 className="rpt-h2">{t("wealthGains")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{t("secondLord")}</dt>
            <dd>
              {planet(facts.secondLord)} · {tr("house")} {facts.secondLordHouse}
            </dd>
          </div>
          <div>
            <dt>{t("eleventhLord")}</dt>
            <dd>
              {planet(facts.eleventhLord)} · {tr("house")} {facts.eleventhLordHouse}
            </dd>
          </div>
          <div>
            <dt>{t("mercuryIn")}</dt>
            <dd>
              {rashi(facts.planets.find((p) => p.id === "mercury")?.rashi ?? 0)} ·{" "}
              {tr("house")} {facts.mercuryHouse}
            </dd>
          </div>
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
      <section className="rpt-card">
        <h2 className="rpt-h2">{t("namingCard")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{t("nakshatraPada")}</dt>
            <dd>
              {nak(facts.moonNakshatra)} · {tr("pada")} {facts.moonNakshatraPad}
            </dd>
          </div>
          <div>
            <dt>{t("namingLetters")}</dt>
            <dd>
              {facts.namingSyllables
                .map((s) => (devanagari ? s.dev : s.rom))
                .join(" · ")}
            </dd>
          </div>
          <div>
            <dt>{t("namingLetter")}</dt>
            <dd style={{ fontSize: 20, fontWeight: 600 }}>
              {devanagari ? facts.namingLetter.dev : facts.namingLetter.rom}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rpt-card">
        <h2 className="rpt-h2">{t("mindLearning")}</h2>
        <dl className="rpt-kv">
          <div>
            <dt>{tr("moonSign")}</dt>
            <dd>{rashi(facts.moonRashi)}</dd>
          </div>
          <div>
            <dt>{t("fifthLord")}</dt>
            <dd>
              {planet(facts.fifthLord)} · {tr("house")} {facts.fifthLordHouse}
            </dd>
          </div>
          <div>
            <dt>{t("jupiterIn")}</dt>
            <dd>
              {rashi(facts.jupiterSign)} · {tr("house")} {facts.jupiterHouse}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rpt-meta">
      <div className="rpt-meta__label">{label}</div>
      <div className="rpt-meta__value">{value}</div>
    </div>
  );
}
