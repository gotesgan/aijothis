import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

const titles: Record<string, { title: string; description: string }> = {
  en: {
    title: "Your Complete Marriage Report | Jyotish",
    description:
      "A detailed Vedic marriage report read from your own birth chart — marriage timing, the partner indicated, Venus & Jupiter, doshas, married life and remedies. One-time, instant download.",
  },
  hi: {
    title: "आपकी विवाह रिपोर्ट | Jyotish",
    description:
      "आपकी जन्म कुंडली से बनी विस्तृत विवाह रिपोर्ट — विवाह का समय, जीवनसाथी, शुक्र-गुरु, दोष, दांपत्य जीवन और उपाय। एक बार का भुगतान, तुरंत डाउनलोड।",
  },
  mr: {
    title: "तुमचा सविस्तर विवाह अहवाल | Jyotish",
    description:
      "तुमच्या जन्मकुंडलीवर आधारित सविस्तर विवाह अहवाल — विवाहाची वेळ, जोडीदार, शुक्र-गुरु, दोष, वैवाहिक जीवन आणि उपाय. एकच पेमेंट, लगेच डाउनलोड.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = titles[locale] ?? titles.en;
  return {
    title: t.title,
    description: t.description,
    alternates: alternatesFor(locale, "report"),
    // A paid funnel, not a content page — keep it out of the index so it can't
    // compete with the homepage for the same brand terms.
    robots: { index: false, follow: true },
  };
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
