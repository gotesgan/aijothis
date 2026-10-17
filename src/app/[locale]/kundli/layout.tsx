import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "My Kundli | Jyotish",
    alternates: alternatesFor(locale, "kundli"),
    robots: { index: false, follow: true },
  };
}

export default function KundliLayout({ children }: { children: React.ReactNode }) {
  return children;
}
