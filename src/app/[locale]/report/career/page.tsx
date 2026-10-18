import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { BackButton } from "@/components/back-button";
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
  const t = await getTranslations({ locale, namespace: "CareerReport" });
  return {
    title: `${t("title")} | Jyotish`,
    description: t("subtitle"),
    alternates: alternatesFor(locale, "report/career"),
    robots: { index: false, follow: true },
  };
}

export default async function CareerReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CareerReport");
  const rt = await getTranslations("Reports");
  const baby = await getTranslations("BabyReport");
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
      </div>

      <ReportFlow type="career" />

      <nav className="no-print doc-crosslinks" aria-label={rt("related")}>
        <Link href="/report">{marriage("eyebrow")}</Link>
        <Link href="/report/baby">{baby("eyebrow")}</Link>
      </nav>

      <div className="no-print">
        <AppNav />
      </div>
    </div>
  );
}
