/**
 * Pack pricing.
 *
 * Two axes, resolved together:
 *
 *  - COHORT — the 20 September 2026 India cutoff that split pre-existing users
 *    (`legacy`) from everyone acquired since (`current`). See PRICING_CUTOFF.
 *  - CURRENCY — INR for the home market, USD/EUR for visitors the edge detects
 *    elsewhere. See @/lib/geo for how region is determined.
 *
 * The legacy menu only ever existed in INR, so it is INR-only by construction.
 * A legacy device that now appears from abroad is served the current menu in
 * that currency — a 2026 INR experiment means nothing at $9.99.
 *
 * Prices are MAJOR-unit decimals (149, 9.99). Minor units are computed at the
 * payment boundary in @/lib/money. Never compare or persist a minor-unit value
 * against these.
 *
 * Each pack's `id` is scoped to BOTH cohort and currency (e.g.
 * `current-standard-usd`). That matters: `orders.pack_id` keys the checkout
 * idempotency lookup, so without the currency suffix a stale INR `created`
 * order could be reused to fulfil a USD checkout at the INR amount.
 */
import type { Currency } from "@/lib/money";
import { formatPrice } from "@/lib/money";

export const PRICING_CUTOFF = "2026-09-20T00:00:00+05:30";

export type PricingCohort = "legacy" | "current";
export type PackTier = "starter" | "standard" | "deep";

export interface QuestionPack {
  /** Unique across cohorts AND currencies. Persisted on `orders.pack_id`. */
  id: string;
  tier: PackTier;
  /** Major-unit decimal in `currency`. */
  price: number;
  currency: Currency;
  questions: number;
  popular?: boolean;
}

interface PackSpec {
  tier: PackTier;
  price: number;
  questions: number;
  popular?: boolean;
}

function menu(
  cohort: PricingCohort,
  currency: Currency,
  specs: readonly PackSpec[]
): readonly QuestionPack[] {
  const tag = currency.toLowerCase();
  return specs.map((spec) => {
    // `formatPrice` renders INR with zero decimals, so a fractional rupee price
    // would display as a DIFFERENT number than the one charged. Assert here, at
    // the single place prices are declared, rather than discovering it in
    // production when someone adds `price: 99.5`.
    if (currency === "INR" && !Number.isInteger(spec.price)) {
      throw new RangeError(
        `pricing: INR pack prices must be whole rupees (got ${spec.price} for ${spec.tier})`
      );
    }
    if (spec.price <= 0) {
      throw new RangeError(`pricing: pack price must be positive (got ${spec.price})`);
    }
    return {
      id: `${cohort}-${spec.tier}-${tag}`,
      tier: spec.tier,
      price: spec.price,
      currency,
      questions: spec.questions,
      ...(spec.popular ? { popular: true } : {}),
    };
  });
}

/**
 * Current menu per currency.
 *
 * The foreign ladders are set against 2026 US/EU market pricing: Co-Star sells
 * 25 questions for $6.99 and a year-ahead for $11.99; Nummi (the closest Vedic
 * AI comparable) is $7.99/mo; human psychic chat runs $1.99–$30/min, so
 * anything under ~$25 is already cheaper than the human alternative. EUR is
 * priced slightly above USD to absorb VAT and the wider spread.
 *
 * Changing a number here changes what real users are charged — re-run the unit
 * economics before moving the default tier.
 */
const CURRENT_MENU: Record<Currency, readonly QuestionPack[]> = {
  INR: menu("current", "INR", [
    { tier: "starter", price: 99, questions: 20 },
    { tier: "standard", price: 149, questions: 50, popular: true },
    { tier: "deep", price: 299, questions: 100 },
  ]),
  USD: menu("current", "USD", [
    { tier: "starter", price: 4.99, questions: 20 },
    { tier: "standard", price: 9.99, questions: 50, popular: true },
    { tier: "deep", price: 19.99, questions: 100 },
  ]),
  EUR: menu("current", "EUR", [
    { tier: "starter", price: 5.49, questions: 20 },
    { tier: "standard", price: 10.99, questions: 50, popular: true },
    { tier: "deep", price: 21.99, questions: 100 },
  ]),
};

/** Pre-cutoff users keep their original quantities at the grandfathered rate. */
const LEGACY_MENU: readonly QuestionPack[] = menu("legacy", "INR", [
  { tier: "starter", price: 60, questions: 10 },
  { tier: "standard", price: 70, questions: 30, popular: true },
  { tier: "deep", price: 80, questions: 50 },
]);

export function cohortForFirstSeen(
  firstSeenAt: string | null | undefined
): PricingCohort {
  if (!firstSeenAt) return "current";
  const timestamp = new Date(firstSeenAt).getTime();
  return Number.isFinite(timestamp) &&
    timestamp < new Date(PRICING_CUTOFF).getTime()
    ? "legacy"
    : "current";
}

export function packsForCohort(
  cohort: PricingCohort,
  currency: Currency
): readonly QuestionPack[] {
  if (cohort === "legacy" && currency === "INR") return LEGACY_MENU;
  return CURRENT_MENU[currency];
}

export function packForTier(
  cohort: PricingCohort,
  tier: string,
  currency: Currency
): QuestionPack | undefined {
  return packsForCohort(cohort, currency).find((pack) => pack.tier === tier);
}

/**
 * Resolves a persisted pack id within ONE market.
 *
 * Deliberately market-scoped. A pack id is only meaningful alongside the
 * currency it was priced in: adopting a pack from another market would leave
 * the paywall highlighting nothing (the id is not in the rendered menu) while
 * the Pay button quoted a price the checkout would not charge. Returns
 * undefined — including for pre-change ids like `p20`, which predate
 * currency-scoped ids entirely — so callers can fall back to their own menu.
 */
export function findPackInMarket(
  cohort: PricingCohort,
  currency: Currency,
  packId: string | null | undefined
): QuestionPack | undefined {
  if (!packId) return undefined;
  return packsForCohort(cohort, currency).find((pack) => pack.id === packId);
}

/** Display string for a pack, e.g. `₹149` or `$9.99`. */
export function formatPackPrice(pack: QuestionPack): string {
  return formatPrice(pack.price, pack.currency);
}

/**
 * ── Loyalty bonus ───────────────────────────────────────────────────────────
 *
 * Closing the paywall three times is a person being told "no" three times. We
 * reward that with BONUS QUESTIONS at the SAME price — the pack reads "60
 * questions" instead of "50" — rather than a price cut.
 *
 * A price cut was rejected deliberately: it is trivially self-served (dismiss
 * three times on any device), it teaches users to dismiss on purpose, and it
 * permanently erodes the reference price that every non-dismisser anchors to.
 * Bonus questions feel equally generous and cost nothing.
 *
 * `price` and `currency` are deliberately untouched — only the credit count
 * changes. That keeps the money path identical (same amount charged, same
 * market-scoped pack id), so this cannot introduce a display-vs-charge drift.
 */
export const PAYWALL_DISMISSALS_FOR_BONUS = 3;
export const BONUS_QUESTIONS = 10;

/**
 * Credits a pack is actually worth. The single source of truth for both the
 * number rendered in the paywall and the number written to `orders.pack_questions`
 * and granted by the webhook — they must never be computed separately.
 *
 * Fails closed: an unearned bonus returns the base count. Legacy users are
 * excluded because they already hold the cheapest menu (₹60/70/80), so a bonus
 * menu would be a price increase wearing a discount label.
 */
export function packQuestionsFor(
  cohort: PricingCohort,
  pack: QuestionPack,
  bonusEarned: boolean
): number {
  if (!bonusEarned || cohort === "legacy") return pack.questions;
  return pack.questions + BONUS_QUESTIONS;
}