"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Collapsible section whose body only mounts when opened — so inline
 * AI features (reading / today) don't generate until the user expands them
 * (unless `defaultOpen` is true).
 */
export function AccordionSection({
  title,
  sub,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  sub?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`acc card ${open ? "acc--open" : ""}`}>
      <button
        className="acc__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="acc__icon">{icon}</span>
        <span className="acc__titles">
          <span className="acc__title">{title}</span>
          {sub && <span className="acc__sub">{sub}</span>}
        </span>
        <ChevronRight size={20} className={`acc__chev ${open ? "acc__chev--open" : ""}`} />
      </button>
      {open && <div className="acc__body">{children}</div>}
    </div>
  );
}
