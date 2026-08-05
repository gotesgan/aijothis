"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getDeviceId } from "@/lib/storage";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import type { KundliResult } from "@/lib/types";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Compact birth-details form rendered inside the chat thread.
 * Submits to /api/kundli and hands the computed chart back to the parent.
 */
export function BirthDetailsCard({
  onComplete,
}: {
  onComplete: (kundli: KundliResult) => void;
}) {
  const t = useTranslations("Details");
  const locale = useLocale();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = date && selected && !submitting;

  // Time is optional — if empty we use the standard 12:00 noon default.
  const effectiveTime = time || "12:00";

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
          mobile: mobile.trim(),
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
      if (!res.ok) throw new Error(data.message ?? "Failed");
      onComplete(data.kundli as KundliResult);
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form className="card birth-card" onSubmit={onSubmit}>
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

      <label className="field">
        <span className="field__label">{t("mobile")}</span>
        <input
          className="field__input"
          type="tel"
          inputMode="numeric"
          maxLength={15}
          data-exclude="true"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+91 98xxxxxxxx"
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
      />

      {error && <p style={{ color: "#ff8f8f", fontSize: 13 }}>{error}</p>}

      <button type="submit" className="btn btn--gold" disabled={!canSubmit}>
        {submitting ? (
          <>
            <Loader2 size={17} className="spin" /> …
          </>
        ) : (
          <>
            {t("submit")} <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
