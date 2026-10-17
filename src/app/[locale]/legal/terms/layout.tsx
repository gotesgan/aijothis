import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Terms & Conditions | Jyotish",
    description:
      "The terms for using Jyotish (Hiarya) — your AI Vedic astrology app.",
    alternates: alternatesFor(locale, "legal/terms"),
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
