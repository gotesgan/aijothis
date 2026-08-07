import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Inter, Fraunces, Tiro_Devanagari_Marathi } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { PixelTracker } from "@/components/pixel-tracker";
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
        </NextIntlClientProvider>
        <Analytics />
        <PixelTracker />
        <Script id="meta-pixel" strategy="beforeInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1909120949758851');`}
        </Script>
        <Script id="clarity-snippet" strategy="beforeInteractive">
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "xxn1pixdrd");`}
        </Script>
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            alt=""
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1909120949758851&ev=PageView&noscript=1"
          />
        </noscript>
      </body>
    </html>
  );
}
