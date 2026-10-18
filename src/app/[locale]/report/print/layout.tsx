import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/lib/seo";

const TITLES: Record<string, string> = {
  en: "Report · Print",
  hi: "रिपोर्ट · प्रिंट",
  mr: "अहवाल · प्रिंट",
};

/**
 * The print view is a document, not a page of the funnel. Without this it
 * inherited the marriage report's title (and canonical) from the parent layout,
 * so a career print announced itself as a marriage report.
 *
 * Still noindex: it is the same paid content, reached from the report itself.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Report" });
  return {
    title: TITLES[locale] ?? TITLES.en,
    description: t("docTitle"),
    alternates: alternatesFor(locale, "report/print"),
    robots: { index: false, follow: false },
  };
}

/** Nothing to wrap: the page renders the whole sheet, and the locale layout
 *  already owns <html>/<body>. This exists for the metadata above. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
