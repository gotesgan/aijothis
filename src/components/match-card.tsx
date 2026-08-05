"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getDeviceId } from "@/lib/storage";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import type { KundliResult } from "@/lib/types";
import { Heart, Loader2 } from "lucide-react";

export interface MatchPrefill {
  name?: string;
  date?: string;
  time?: string;
}

/**
 * Compact form to capture a second person's birth details for kundli-matching.
 * Submits to /api/kundli with `match: true` (so the user's own profile is not
 * overwritten) and hands the computed chart back to the parent.
 */
export function MatchCard({
  prefill,
  onComplete,
  onCancel,
}: {
  prefill?: MatchPrefill;
  onComplete: (kundli: KundliResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Match");
  const locale = useLocale();

  const [name, setName] = useState(prefill?.name ?? "");
  const [date, setDate] = useState(prefill?.date ?? "");
  const [time, setTime] = useState(prefill?.time ?? "");
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = date && time && selected && !submitting;

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
          name: name.trim() || "Partner",
          date,
          time,
          place: selected.place,
          lat: selected.lat,
          lng: selected.lng,
          timezone: selected.timezone,
          lang: locale,
          match: true,
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
    <form className="card birth-card match-card" onSubmit={onSubmit}>
      <span className="match-card__badge">
        <Heart size={13} /> {t("badge")}
      </span>

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

      <PlaceAutocomplete
        label={t("pob")}
        placeholder={t("pobPh")}
        onSelect={setSelected}
        onEdit={() => setSelected(null)}
      />

      {error && <p style={{ color: "#ff8f8f", fontSize: 13 }}>{error}</p>}

      <div className="match-card__actions">
        <button
          type="submit"
          className="btn btn--gold"
          disabled={!canSubmit}
        >
          {submitting ? (
            <>
              <Loader2 size={17} className="spin" /> …
            </>
          ) : (
            <>{t("submit")}</>
          )}
        </button>
        <button
          type="button"
          className="gate-modal__ghost"
          onClick={onCancel}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
