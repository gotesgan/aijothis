import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
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
  const nav = await getTranslations("Nav");
  const baby = await getTranslations("BabyReport");
  const marriage = await getTranslations("Report");

  return (
    <div className="screen">
      {/* Each chrome block is `.no-print`: the report prints to PDF from this page. */}
      <div className="no-print">
        <Header />
      </div>

      <div className="no-print" style={{ paddingTop: 18 }}>
        <Link
          href="/"
          className="faint"
          style={{ fontSize: 14, display: "inline-block", marginBottom: 12 }}
        >
          ‹ {nav("home")}
        </Link>
        <span className="badge badge--gold">{t("eyebrow")}</span>
        <h1
          style={{
            fontFamily: "var(--stack-display)",
            fontSize: 30,
            fontWeight: 600,
            margin: "12px 0 6px",
            lineHeight: 1.15,
          }}
        >
          {t("title")}
        </h1>
        <p className="faint" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 560 }}>
          {t("subtitle")}
        </p>
      </div>

      <ReportFlow type="career" />

      <div className="no-print" style={{ marginTop: 26 }}>
        <p className="faint" style={{ fontSize: 13.5, marginBottom: 10 }}>
          <Link href="/report" className="faint" style={{ textDecoration: "underline" }}>
            {marriage("eyebrow")}
          </Link>
          {" · "}
          <Link
            href="/report/baby"
            className="faint"
            style={{ textDecoration: "underline" }}
          >
            {baby("eyebrow")}
          </Link>
        </p>
      </div>

      <div className="no-print">
        <AppNav />
      </div>
    </div>
  );
}
