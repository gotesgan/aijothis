/**
 * Currency primitives. Prices are stored and compared as MAJOR-unit decimals
 * (99, 149, 9.99); they are only converted to minor units at the payment
 * boundary, where the currency's exponent matters.
 *
 * Razorpay's exponent table (docs/payments/international-payments): INR, USD
 * and EUR are all exponent 2. Exponent is still modelled explicitly so adding
 * JPY/KWD later cannot silently send 100x the intended amount.
 */
export type Currency = "INR" | "USD" | "EUR";

export const SUPPORTED_CURRENCIES: readonly Currency[] = ["INR", "USD", "EUR"];

const CURRENCY_EXPONENT: Record<Currency, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value as Currency);
}

/**
 * Major-unit decimal → minor units (Razorpay `amount`).
 *
 * Throws rather than clamping on bad input: a silently returned 0 would create
 * a real ₹0 order at Razorpay and fail opaquely much later, whereas throwing
 * here surfaces the typo where it happened.
 */
export function toMinorUnits(amount: number, currency: Currency): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`toMinorUnits: amount must be finite, got ${amount}`);
  }
  if (amount < 0) {
    throw new RangeError(`toMinorUnits: amount must not be negative, got ${amount}`);
  }
  return Math.round(amount * 10 ** CURRENCY_EXPONENT[currency]);
}

/** Minor units → major-unit decimal. Accepts the DB's legacy `*_paise` name. */
export function fromMinorUnits(minor: number, currency: Currency): number {
  if (!Number.isFinite(minor)) return 0;
  return minor / 10 ** CURRENCY_EXPONENT[currency];
}

/**
 * Display formatting.
 *  - INR renders as whole rupees with the Indian digit grouping (`₹1,499`).
 *    Fractional rupees read as noise on a pack menu.
 *  - USD/EUR keep two decimals so `.99` style price anchoring survives.
 * Locale is pinned to `en-US` for the foreign currencies: an `en-IN` locale
 * renders USD as `US$9.99`, which leaks the home market into a US checkout.
 */
export function formatPrice(amount: number, currency: Currency): string {
  if (!Number.isFinite(amount)) return "";
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}