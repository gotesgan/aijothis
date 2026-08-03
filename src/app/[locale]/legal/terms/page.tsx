"use client";

import { useLocale } from "next-intl";
import { TERMS } from "@/lib/legal";
import { LegalView } from "@/components/legal-view";
import type { LegalLocale } from "@/lib/legal";

export default function TermsPage() {
  const locale = useLocale() as LegalLocale;
  return <LegalView doc={TERMS[locale] ?? TERMS.en} />;
}
