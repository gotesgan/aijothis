import { setRequestLocale } from "next-intl/server";
import { AryaChat } from "@/components/arya-chat";
import type { Metadata } from "next";

const titles: Record<string, { title: string; description: string }> = {
  en: {
    title: "Chat with Arya — AI Vedic Astrologer | Jyotish",
    description:
      "Ask Arya about marriage timing, career, love, money or health — answers grounded in your real Vedic Kundli and today's transits.",
  },
  hi: {
    title: "आर्य से चैट करें — AI वैदिक ज्योतिषी | Jyotish",
    description:
      "शादी, करियर, प्रेम, धन या स्वास्थ्य के बारे में आर्य से पूछें — जवाब आपकी असली वैदिक कुंडली पर आधारित।",
  },
  mr: {
    title: "आर्यशी चॅट करा — AI वैदिक ज्योतिषी | Jyotish",
    description:
      "लग्न, करिअर, प्रेम, पैसा किंवा आरोग्य विचारा — उत्तरे तुमच्या खऱ्या वैदिक कुंडलीवर आधारित.",
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

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  return <AryaChat initialQ={q} />;
}
