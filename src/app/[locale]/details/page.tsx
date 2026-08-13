import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { AppNav } from "@/components/app-nav";
import { DetailsForm } from "@/components/details-form";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

const titles: Record<string, { title: string; description: string }> = {
  en: {
    title: "Get Your Free Vedic Kundli Online | Jyotish",
    description:
      "Enter your birth date, time and place to get your free Vedic Kundli — Lagna, Rashi, Nakshatra and Dasha — computed instantly with the Swiss Ephemeris.",
  },
  hi: {
    title: "मुफ्त वैदिक कुंडली बनाएं ऑनलाइन | Jyotish",
    description:
      "जन्म तारीख, समय और स्थान दर्ज करें — आपकी मुफ्त वैदिक कुंडली (लग्न, राशि, नक्षत्र, दशा) सेकंदों में।",
  },
  mr: {
    title: "मोफत वैदिक कुंडली ऑनलाइन बनवा | Jyotish",
    description:
      "जन्मतारीख, वेळ आणि ठिकाण टाका — तुमची मोफत वैदिक कुंडली (लग्न, राशी, नक्षत्र, दशा) सेकंदात.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = titles[locale] ?? titles.en;
  return { title: t.title, description: t.description };
}

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
