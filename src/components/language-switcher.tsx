"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Check, Globe } from "lucide-react";
import { routing, localeNames, type Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("Lang");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function switchTo(next: string) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    router.replace(pathname, { locale: next });
    setOpen(false);
  }

  return (
    <div className="lang-switch">
      <button
        className="lang-switch__btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("label")}
        aria-expanded={open}
      >
        <Globe size={15} />
        {localeNames[locale]}
      </button>

      {open && (
        <div className="lang-switch__menu">
          {routing.locales.map((l) => (
            <button
              key={l}
              className={`lang-switch__opt ${l === locale ? "lang-switch__opt--active" : ""}`}
              onClick={() => switchTo(l)}
            >
              {localeNames[l as Locale]}
              {l === locale && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
