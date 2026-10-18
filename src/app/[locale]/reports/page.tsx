import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Header } from "@/components/header";
import { BackButton } from "@/components/back-button";
import { AppNav } from "@/components/app-nav";
import { ReportRows } from "@/components/report-rows";
import { REPORT_PRICES, type ReportType } from "@/lib/report";
import { resolveCurrencyFromServer } from "@/lib/region-server";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Reports" });
  return {
    title: `${t("title")} — Jyotish`,
    description: t("subtitle"),
    alternates: alternatesFor(locale, "reports"),
    robots: { index: false, follow: true },
  };
}

/**
 * The hub for the three paid readings.
 *
 * Until now the report pages existed but nothing linked to them from the app
 * chrome — you had to already know the URL. This is their entry point.
 *
 * Prices come from REPORT_PRICES (the same table /api/report-checkout charges
 * from) and the currency from the server's region resolution, so the number
 * shown here cannot drift from the number charged.
 */
const ITEMS: { type: ReportType; href: string; titleKey: string; descKey: string }[] = [
  { type: "marriage", href: "/report", titleKey: "marriageTitle", descKey: "marriageDesc" },
  { type: "career", href: "/report/career", titleKey: "careerTitle", descKey: "careerDesc" },
  { type: "child", href: "/report/baby", titleKey: "childTitle", descKey: "childDesc" },
];

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Reports");
  const currency = await resolveCurrencyFromServer();

  return (
    <div className="screen screen--doc">
      <Header />

      <div>
        <BackButton className="back-btn--doc" />
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede">{t("subtitle")}</p>
      </div>

      <ReportRows
        items={ITEMS.map(({ type, href, titleKey, descKey }) => ({
          type,
          href,
          title: t(titleKey),
          desc: t(descKey),
        }))}
        prices={Object.fromEntries(
          ITEMS.map(({ type }) => [type, REPORT_PRICES[type][currency]])
        )}
        currency={currency}
      />

      <div className="screen__grow" />

      <AppNav />
    </div>
  );
}
