"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveKundli, getDeviceId } from "@/lib/storage";
import type { KundliResult } from "@/lib/types";
import { PlaceAutocomplete, type PlaceSelection } from "./place-autocomplete";
import { ArrowRight, Loader2 } from "lucide-react";

export function DetailsForm() {
  const t = useTranslations("Details");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    name.trim() && date && time && selected && !submitting;

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
      router.push("/chat");
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

      <label className="field">
        <span className="field__label">{t("mobile")}</span>
        <input
          className="field__input"
          type="tel"
          inputMode="numeric"
          maxLength={15}
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

      <PlaceAutocomplete
        label={t("pob")}
        placeholder={t("pobPh")}
        onSelect={setSelected}
        onEdit={() => setSelected(null)}
      />

      <p className="faint" style={{ fontSize: 13 }}>
        {t("unknownTime")}
      </p>

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
        {t("submitNote")}
      </p>
    </form>
  );
}
