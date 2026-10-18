"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getDeviceId } from "@/lib/storage";
import { formatPrice } from "@/lib/money";
import type { Currency } from "@/lib/money";
import type { ReportType } from "@/lib/report";

type Owned = { type: ReportType; purchased: boolean; stored: boolean };

const subscribeNoop = () => () => {};

/**
 * What this person has already unlocked.
 *
 * The hub is server-rendered (prices come from the server's region), but
 * ownership is device-scoped and the device id only exists in the browser — so
 * this asks the API after mount and upgrades the rows in place. Rows render
 * immediately as "Preview" (the correct answer for a new visitor, and the
 * server-rendered default), then swap to "Open report" once ownership is known.
 */
export function ReportRows({
  items,
  prices,
  currency,
}: {
  items: { type: ReportType; href: string; title: string; desc: string }[];
  prices: Record<string, number>;
  currency: Currency;
}) {
  const t = useTranslations("Reports");
  const [owned, setOwned] = useState<Record<string, Owned>>({});
  // Nothing to subscribe to: ownership is fetched once, not pushed.
  const deviceReady = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!deviceReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/reports", {
          headers: { "x-device-id": getDeviceId() },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { reports?: Owned[] };
        if (cancelled || !Array.isArray(data.reports)) return;
        const next: Record<string, Owned> = {};
        for (const r of data.reports) if (r?.type) next[r.type] = r;
        setOwned(next);
      } catch {
        // Fail soft: the rows simply keep saying "Preview".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceReady]);

  const anyOwned = items.some((i) => owned[i.type]?.purchased);

  return (
    <>
      <ul className="reports-list rpt-facts">
        {items.map(({ type, href, title, desc }) => {
          const isOwned = owned[type]?.purchased === true;
          return (
            <li key={type}>
              <Link href={href} className="report-row">
                <span className="report-row__title">{title}</span>
                <span className="report-row__price">
                  {isOwned ? (
                    <span className="report-row__owned">
                      <Check size={13} aria-hidden="true" />
                      {t("unlocked")}
                    </span>
                  ) : (
                    formatPrice(prices[type] ?? 0, currency)
                  )}
                </span>
                <span className="report-row__desc">{desc}</span>
                <span className="report-row__cta">
                  {isOwned ? t("openCta") : t("previewCta")}
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="reports-note">{anyOwned ? t("ownedNote") : t("freeNote")}</p>
    </>
  );
}
