type FbqFn = (
  cmd: "track" | "trackCustom",
  event: string,
  params?: Record<string, unknown>
) => void;

function fbq(): FbqFn | null {
  const w = window as unknown as { fbq?: FbqFn };
  return w.fbq ?? null;
}

/** Standard event: every page/route view. */
export function trackPageView() {
  fbq()?.("track", "PageView");
}

/** Micro-conversion: birth details submitted and a Kundli was computed. */
export function trackLead() {
  fbq()?.("track", "Lead");
}

/** The paywall / pack offer was shown. */
export function trackInitiateCheckout() {
  fbq()?.("track", "InitiateCheckout");
}

/** A pack was granted — value in INR. */
export function trackPurchase(amountInRupees: number) {
  fbq()?.("track", "Purchase", {
    value: amountInRupees,
    currency: "INR",
  });
}

/** Custom event with optional params. */
function trackCustom(event: string, params?: Record<string, unknown>) {
  fbq()?.("trackCustom", event, params);
}

/** Google signup gate completed. */
export function trackSignup() {
  trackCustom("Signup");
}

/** First user question got a real answer (activation). */
export function trackFirstAnswer() {
  trackCustom("FirstAnswer");
}

/** Free limit reached and the pack offer was shown. */
export function trackPaywallShown() {
  trackCustom("PaywallShown");
}

/** A pack tier was selected in the paywall. */
export function trackPackSelected(amountInRupees: number) {
  trackCustom("PackSelected", { value: amountInRupees, currency: "INR" });
}

/** The paywall was closed without buying. */
export function trackPaywallDismissed() {
  trackCustom("PaywallDismissed");
}

const firedQuestionChips = new Set<string>();

/** A landing question chip was tapped (fires once per question per session). */
export function trackQuestionChip(question: string) {
  if (firedQuestionChips.has(question)) return;
  firedQuestionChips.add(question);
  trackCustom("QuestionChip", { q: question });
}
