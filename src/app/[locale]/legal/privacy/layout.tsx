import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Privacy Policy | Jyotish",
    description:
      "How Jyotish (Hiarya) handles your birth details, chat messages and payment data.",
    alternates: alternatesFor(locale, "legal/privacy"),
  };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
