"use client";

import { useEffect, useState } from "react";import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { saveKundli, getDeviceId } from "@/lib/storage";
import { trackLead, trackQuestionChip } from "@/lib/pixel";
import type { KundliResult } from "@/lib/types";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import { ArrowRight, Loader2 } from "lucide-react";
import posthog from "posthog-js";

export function DetailsForm({ initialQ }: { initialQ?: string }) {
  const t = useTranslations("Details");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  // The place TEXT to display for a pre-filled form, held separately from
  // `selected` because the visible text lives inside PlaceAutocomplete.
  const [prefillPlace, setPrefillPlace] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() && date && selected && !submitting;

  // Time is optional — if empty we use the standard 12:00 noon default.
  const effectiveTime = time || "12:00";

  // A carried question means the user came in via a landing chip.
  useEffect(() => {
    if (initialQ) trackQuestionChip(initialQ);
  }, [initialQ]);

  /**
   * Pre-fill from the profile this person already has.
   *
   * The birth details live on `profiles` from their first visit, so landing on
   * an empty form asks a returning user to retype facts we already hold — the
   * single most reported piece of friction in this funnel. This is the safety
   * net for every path that reaches /details: a bookmark, a back-navigation, or
   * tapping a landing chip faster than the resume redirect can fire.
   *
   * Only ever fills EMPTY fields, and only once, so it can never overwrite
   * something the user is in the middle of typing or correcting.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Something already here (same device, or they started typing) — leave
      // their input strictly alone.
      if (name.trim() || date || time || selected) return;
      try {
        const res = await fetch("/api/me", { headers: { "x-device-id": getDeviceId() } });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data?.birth) return;
        setName((prev) => prev || data.name || "");
        setDate((prev) => prev || data.birth.date || "");
        setTime((prev) => prev || data.birth.time || "");
        setSelected((prev) =>
          prev ?? {
            place: data.birth.place,
            lat: data.birth.lat,
            lng: data.birth.lng,
            timezone: data.birth.timezone,
          }
        );
        setPrefillPlace((prev) => prev ?? data.birth.place);
      } catch {
        // Fail soft — the form still works, it just starts empty.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount; the guards above make re-runs a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kundli", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({
          name: name.trim(),
          date,
          time: effectiveTime,
          place: selected.place,
          lat: selected.lat,
          lng: selected.lng,
          timezone: selected.timezone,
          lang: locale,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      const kundli: KundliResult = data.kundli;
      saveKundli(kundli);
      trackLead();
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
        posthog.capture("birth_chart_generated", { source: "details_form" });
      }
      router.push(initialQ ? { pathname: "/chat", query: { q: initialQ } } : "/chat");
    } catch (err) {
      setError((err as Error).message ?? "Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="details-form" onSubmit={onSubmit}>
      <label className="field">
        <span className="field__label">{t("name")}</span>
        <input
          className="field__input"
          type="text"
          data-exclude="true"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePh")}
        />
      </label>

      <div className="details-form__row">
        <label className="field">
          <span className="field__label">{t("dob")}</span>
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
          <span className="field__label">{t("tob")}</span>
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
          {t("unknownTime")}
        </p>
      )}

      <PlaceAutocomplete
        label={t("pob")}
        placeholder={t("pobPh")}
        onSelect={setSelected}
        onEdit={() => setSelected(null)}
        // Changing the key is what applies the pre-fill: it remounts the input
        // so its internal `query` state starts from the saved place. The key
        // is deliberately NOT reset on edit — that would remount mid-typing
        // and discard what the user just entered.
        key={prefillPlace ?? "no-prefill"}
        initialPlace={prefillPlace}
      />

      {error && (
        <p style={{ color: "#ff8f8f", fontSize: 13 }}>{error}</p>
      )}

      <button
        type="submit"
        className="btn btn--gold btn--lg"
        disabled={!canSubmit}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="spin" /> …
          </>
        ) : (
          <>
            {t("submit")} <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className="faint" style={{ fontSize: 13, textAlign: "center" }}>
        {t("noSignup")}
      </p>

      <p className="faint" style={{ fontSize: 11.5, textAlign: "center", lineHeight: 1.5 }}>
        {t.rich("agreeSubmit", {
          t: () => (
            <Link href="/legal/terms" style={{ textDecoration: "underline" }}>
              {t("terms")}
            </Link>
          ),
          p: () => (
            <Link href="/legal/privacy" style={{ textDecoration: "underline" }}>
              {t("privacy")}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
