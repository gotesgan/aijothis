import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { AppNav } from "@/components/app-nav";
import { DetailsForm } from "@/components/details-form";
import { Link } from "@/i18n/navigation";

export default async function DetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Details");
  const nav = await getTranslations("Nav");

  return (
    <div className="screen">
      <Header />
      <div style={{ paddingTop: 18 }}>
        <Link
          href="/"
          className="faint"
          style={{ fontSize: 14, display: "inline-block", marginBottom: 12 }}
        >
          ‹ {nav("generateKundli")}
        </Link>
        <span className="badge badge--gold">{t("step")}</span>
        <h1
          style={{
            fontFamily: "var(--stack-display)",
            fontSize: 28,
            fontWeight: 600,
            margin: "12px 0 4px",
          }}
        >
          {t("title")}
        </h1>
        <DetailsForm initialQ={q} />
      </div>

      <AppNav />
    </div>
  );
}
