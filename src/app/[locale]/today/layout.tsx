import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Today's Vedic Reading | Jyotish",
    description:
      "Your day read from today's transits against your own Kundli — career, love, money and health.",
    alternates: alternatesFor(locale, "today"),
    // Rendered client-side from locally stored birth details, so a crawler sees
    // an empty shell. Keep it out of the index to avoid a thin/doorway signal.
    robots: { index: false, follow: true },
  };
}

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
