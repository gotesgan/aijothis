"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import {
  allGranted,
  allRefused,
  CONSENT_VERSION,
  notifyConsentChanged,
  parseConsent,
  readConsentRaw,
  subscribeToConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/consent";

/** Dispatched by the footer control to re-open preferences for withdrawal. */
export const OPEN_CONSENT_EVENT = "jyotish:open-consent";

type Mode = "choose" | "review";
interface Panel {
  mode: Mode;
}

/**
 * Cookie consent banner.
 *
 * Deliberately a NON-BLOCKING bottom sheet rather than a full-screen modal. A
 * visitor who hasn't answered yet is one we may keep serving — we simply send
 * them nothing — and burying the site behind a wall is the fastest way to
 * collect a reflex "accept all", including from people who would have said no.
 *
 * Mobile-first because most traffic is mobile: anchored to the bottom edge
 * within thumb reach, full-bleed, clear of the iOS home indicator, and scrolls
 * internally if the expanded panel exceeds the viewport.
 *
 * Visibility is DERIVED from the consent store, not synchronised into it. With
 * nothing stored the sheet is open; once a choice exists it closes, so saving
 * hides it without a second source of truth.
 */
export function ConsentBanner() {
  const t = useTranslations("Consent");

  const raw = useSyncExternalStore(subscribeToConsent, readConsentRaw, () => null);
  const consent = parseConsent(raw);

  // Only user intent lives here. Null means "use the derived default".
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  const openPreferences = useCallback(() => setPanel({ mode: "review" }), []);

  useEffect(() => {
    const handler = () => openPreferences();
    window.addEventListener(OPEN_CONSENT_EVENT, handler);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, handler);
  }, [openPreferences]);

  const commit = (next: ConsentState) => {
    writeConsent(next);
    setPanel(null);
    notifyConsentChanged();
  };

  // Nothing stored yet → ask. After saving, `consent` becomes non-null so the
  // derived default closes the sheet.
  const mode: Mode | null =
    panel?.mode ?? (consent === null ? "choose" : null);
  if (!mode) return null;

  const toggle = (key: "analytics" | "marketing") =>
    setDraft((d) => ({ ...d, [key]: !d[key] }));

  const rows = [
    { key: "analytics" as const, label: t("analytics"), desc: t("analyticsDesc") },
    { key: "marketing" as const, label: t("marketing"), desc: t("marketingDesc") },
  ];

  return (
    <div className="consent" role="dialog" aria-modal="false" aria-label={t("title")}>
      <div className="consent__sheet">
        {mode === "choose" ? (
          <>
            <h2 className="consent__title">{t("title")}</h2>
            <p className="consent__body">
              {t("body")}{" "}
              <Link href="/legal/privacy" className="consent__link">
                {t("privacyLink")}
              </Link>
            </p>
            <div className="consent__actions">
              <button
                type="button"
                className="btn btn--gold consent__accept"
                onClick={() => commit(allGranted())}
              >
                {t("acceptAll")}
              </button>
              <button
                type="button"
                className="btn consent__reject"
                onClick={() => commit(allRefused())}
              >
                {t("rejectAll")}
              </button>
            </div>
            <button type="button" className="consent__customise" onClick={() => setPanel({ mode: "review" })}>
              {t("customise")}
            </button>
          </>
        ) : (
          <>
            <h2 className="consent__title">{t("customTitle")}</h2>
            <div className="consent__rows">
              <div className="consent__row">
                <div className="consent__rowtext">
                  <span className="consent__rowlabel">{t("necessary")}</span>
                  <span className="consent__rowdesc">{t("necessaryDesc")}</span>
                </div>
                <span className="consent__locked">{t("alwaysOn")}</span>
              </div>
              {rows.map((row) => (
                <div className="consent__row" key={row.key}>
                  <div className="consent__rowtext">
                    <span className="consent__rowlabel" id={`consent-label-${row.key}`}>
                      {row.label}
                    </span>
                    <span className="consent__rowdesc">{row.desc}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft[row.key]}
                    aria-labelledby={`consent-label-${row.key}`}
                    className={`consent__switch${draft[row.key] ? " consent__switch--on" : ""}`}
                    onClick={() => toggle(row.key)}
                  >
                    <span className="consent__knob" />
                  </button>
                </div>
              ))}
            </div>
            <div className="consent__actions">
              <button
                type="button"
                className="btn btn--gold consent__accept"
                onClick={() =>
                  commit({
                    version: CONSENT_VERSION,
                    analytics: draft.analytics,
                    marketing: draft.marketing,
                    decidedAt: new Date().toISOString(),
                  })
                }
              >
                {t("save")}
              </button>
              <button type="button" className="btn consent__reject" onClick={() => setPanel(null)}>
                {t("cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Footer control, so a stored choice can be changed or withdrawn. */
export function ConsentSettingsLink() {
  const t = useTranslations("Consent");
  return (
    <button
      type="button"
      className="footer__linkbtn"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      {t("settings")}
    </button>
  );
}