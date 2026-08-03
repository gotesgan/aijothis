"use client";

import { useLocale } from "next-intl";
import { PRIVACY } from "@/lib/legal";
import { LegalView } from "@/components/legal-view";
import type { LegalLocale } from "@/lib/legal";

export default function PrivacyPage() {
  const locale = useLocale() as LegalLocale;
  return <LegalView doc={PRIVACY[locale] ?? PRIVACY.en} />;
}
