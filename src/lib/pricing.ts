/**
 * Pack pricing is cohort-based. The cutoff is the beginning of 20 September
 * 2026 in India, when the new acquisition pricing began.
 */
export const PRICING_CUTOFF = "2026-09-20T00:00:00+05:30";

export type PricingCohort = "legacy" | "current";
export type PackTier = "starter" | "standard" | "deep";

export interface QuestionPack {
  id: string;
  tier: PackTier;
  price: number;
  questions: number;
  popular?: boolean;
}

/** Users first seen from the cutoff onward receive the new menu. */
export const CURRENT_PACKS: readonly QuestionPack[] = [
  { id: "current-starter", tier: "starter", price: 99, questions: 20 },
  { id: "current-standard", tier: "standard", price: 149, questions: 50, popular: true },
  { id: "current-deep", tier: "deep", price: 299, questions: 100 },
];

/** Existing users keep their original question quantities at +₹50 per pack. */
export const LEGACY_PACKS: readonly QuestionPack[] = [
  { id: "legacy-starter", tier: "starter", price: 60, questions: 10 },
  { id: "legacy-standard", tier: "standard", price: 70, questions: 30, popular: true },
  { id: "legacy-deep", tier: "deep", price: 80, questions: 50 },
];

export function cohortForFirstSeen(firstSeenAt: string | null | undefined): PricingCohort {
  if (!firstSeenAt) return "current";
  const timestamp = new Date(firstSeenAt).getTime();
  return Number.isFinite(timestamp) && timestamp < new Date(PRICING_CUTOFF).getTime()
    ? "legacy"
    : "current";
}

export function packsForCohort(cohort: PricingCohort): readonly QuestionPack[] {
  return cohort === "legacy" ? LEGACY_PACKS : CURRENT_PACKS;
}

export function packForTier(
  cohort: PricingCohort,
  tier: string
): QuestionPack | undefined {
  return packsForCohort(cohort).find((pack) => pack.tier === tier);
}
