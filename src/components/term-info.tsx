"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/** Inline explainer for Vedic terms — tapping the ⓘ reveals a short tip. */
export function TermInfo({ label, tip }: { label: string; tip: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="term-info">
      <span className="term-info__label">{label}</span>
      <button
        className="term-info__btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={tip}
        type="button"
      >
        <Info size={13} />
      </button>
      {open && <span className="term-info__tip">{tip}</span>}
    </span>
  );
}
