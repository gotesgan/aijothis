"use client";

import { useEffect, useState } from "react";import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveKundli, getDeviceId } from "@/lib/storage";
import { trackLead, trackQuestionChip } from "@/lib/pixel";
import type { KundliResult } from "@/lib/types";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import { ArrowRight, Loader2, Clock } from "lucide-react";

export function DetailsForm({ initialQ }: { initialQ?: string }) {
  const t = useTranslations("Details");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() && date && time && selected && !submitting;

  // A carried question means the user came in via a landing chip.
  useEffect(() => {
    if (initialQ) trackQuestionChip(initialQ);
  }, [initialQ]);

  function toggleUnknownTime() {
    setTimeUnknown((v) => {
      const next = !v;
      setTime(next ? "12:00" : "");
      return next;
    });
  }

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
          time,
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
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        className="time-toggle"
        onClick={toggleUnknownTime}
      >
        <Clock size={15} />
        {t("toggleUnknown")}
      </button>
      {timeUnknown && (
        <p className="faint" style={{ fontSize: 12, marginTop: -8 }}>
          {t("unknownTime")}
        </p>
      )}

      <PlaceAutocomplete
        label={t("pob")}
        placeholder={t("pobPh")}
        onSelect={setSelected}
        onEdit={() => setSelected(null)}
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
    </form>
  );
}
