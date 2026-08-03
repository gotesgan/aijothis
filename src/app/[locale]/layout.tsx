import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Inter, Fraunces, Tiro_Devanagari_Marathi } from "next/font/google";
import { routing } from "@/i18n/routing";
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
    title: "Jyotish — AI Vedic Astrologer",
    description:
      locale === "en"
        ? "Chat with Arya, your AI Vedic astrologer. Get your free Kundli in seconds."
        : locale === "hi"
          ? "आर्य से बात करें — आपका AI वैदिक ज्योतिषी। मुफ्त कुंडली सेकंडों में।"
          : "आर्यशी बोला — तुमचा AI वैदिक ज्योतिषी. मोफत कुंडली सेकंदात.",
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
