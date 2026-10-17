import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Your Reading Overview | Jyotish",
    alternates: alternatesFor(locale, "overview"),
    robots: { index: false, follow: true },
  };
}

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
