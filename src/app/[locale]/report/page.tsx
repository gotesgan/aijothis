import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { BackButton } from "@/components/back-button";
import { REPORT_PRICES } from "@/lib/report";
import { resolveCurrencyFromServer } from "@/lib/region-server";
import { formatPrice } from "@/lib/money";
import { AppNav } from "@/components/app-nav";
import { MarriageReport } from "@/components/marriage-report";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Report");
  const tc = await getTranslations("Common");
  const currency = await resolveCurrencyFromServer();

  return (
    <div className="screen screen--doc">
      {/*
        Each chrome block is wrapped in `.no-print`: the report is printed to PDF
        from this same page (window.print), so the nav, hero and CTA must be
        excluded in print CSS. See `.rpt-*` rules in globals.css.
      */}
      <div className="no-print">
        <Header />
      </div>

      <div className="no-print">
        <BackButton className="back-btn--doc" />
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede">{t("subtitle")}</p>
        <p className="doc-price">
          <span className="doc-price__amount">
            {formatPrice(REPORT_PRICES.marriage[currency], currency)}
          </span>
          <span className="doc-price__note">{tc("oneTime")}</span>
        </p>
      </div>

      <MarriageReport />

      <div className="no-print">
        <AppNav />
      </div>
    </div>
  );
}
