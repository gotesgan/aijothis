import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { AppNav } from "@/components/app-nav";
import { MarriageReport } from "@/components/marriage-report";
import { Link } from "@/i18n/navigation";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Report");
  const nav = await getTranslations("Nav");

  return (
    <div className="screen">
      {/*
        Each chrome block is wrapped in `.no-print`: the report is printed to PDF
        from this same page (window.print), so the nav, hero and CTA must be
        excluded in print CSS. See `.rpt-*` rules in globals.css.
      */}
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

      <MarriageReport />

      <div className="no-print">
        <AppNav />
      </div>
    </div>
  );
}
