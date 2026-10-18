import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { BackButton } from "@/components/back-button";
import { REPORT_PRICES } from "@/lib/report";
import { resolveCurrencyFromServer } from "@/lib/region-server";
import { formatPrice } from "@/lib/money";
import { AppNav } from "@/components/app-nav";
import { ReportFlow } from "@/components/report-flow";
import { Link } from "@/i18n/navigation";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "BabyReport" });
  return {
    title: `${t("title")} | Jyotish`,
    description: t("subtitle"),
    alternates: alternatesFor(locale, "report/baby"),
    robots: { index: false, follow: true },
  };
}

export default async function BabyReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("BabyReport");
  const tc = await getTranslations("Common");
  const currency = await resolveCurrencyFromServer();
  const rt = await getTranslations("Reports");
  const career = await getTranslations("CareerReport");
  const marriage = await getTranslations("Report");

  return (
    <div className="screen screen--doc">
      {/* Each chrome block is `.no-print`: the report prints to PDF from this page. */}
      <div className="no-print">
        <Header />
      </div>

      <div className="no-print">
        <BackButton className="back-btn--doc" />
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede">{t("subtitle")}</p>
        <p className="doc-price">
          <span className="doc-price__amount">
            {formatPrice(REPORT_PRICES.child[currency], currency)}
          </span>
          <span className="doc-price__note">{tc("oneTime")}</span>
        </p>
      </div>

      <ReportFlow type="child" />

      <nav className="no-print doc-crosslinks" aria-label={rt("related")}>
        <Link href="/report">{marriage("eyebrow")}</Link>
        <Link href="/report/career">{career("eyebrow")}</Link>
      </nav>

      <div className="no-print">
        <AppNav />
      </div>
    </div>
  );
}
