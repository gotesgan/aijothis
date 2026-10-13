import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Inter, Fraunces, Tiro_Devanagari_Marathi } from "next/font/google";
import { Trackers } from "@/components/trackers";
import { ConsentBanner } from "@/components/consent-banner";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});

const tiro = Tiro_Devanagari_Marathi({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-devanagari",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Jyotish",
    applicationName: "Jyotish",
    description:
      locale === "en"
        ? "Chat with Arya, your AI Vedic astrologer. Get your personal Kundli in seconds."
        : locale === "hi"
          ? "आर्य से बात करें — आपका AI वैदिक ज्योतिषी। मुफ्त कुंडली सेकंदों में।"
          : "आर्यशी बोला — तुमचा AI वैदिक ज्योतिषी. मोफत कुंडली सेकंदात.",
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "x-default": "/en",
        en: "/en",
        hi: "/hi",
        mr: "/mr",
      },
    },
    openGraph: {
      title: "Jyotish",
      siteName: "Jyotish",
      description:
        "Jyotish is an AI Vedic astrology app. Share your birth details and chat with Arya for personal answers on love, marriage, career, money and health — grounded in your real Kundli.",
      url: `${SITE_URL}/${locale}`,
      locale: locale === "en" ? "en_IN" : locale === "hi" ? "hi_IN" : "mr_IN",
    },
    twitter: {
      card: "summary",
      title: "Jyotish",
      description:
        "AI Vedic astrology — chat with Arya for personal answers grounded in your real Kundli.",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };

}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${fraunces.variable} ${tiro.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <div className="app-shell">{children}</div>
          {/* Both live inside the provider: the banner calls useTranslations. */}
          <Trackers />
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
