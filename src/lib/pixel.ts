type FbqFn = (
  cmd: "track" | "trackCustom",
  event: string,
  params?: Record<string, unknown>
) => void;

function fbq(): FbqFn | null {
  const w = window as unknown as { fbq?: FbqFn };
  return w.fbq ?? null;
}

type ClarityFn = (
  cmd: "event",
  name: string,
  metadata?: Record<string, unknown>
) => void;

function clarity(): ClarityFn | null {
  const w = window as unknown as { clarity?: ClarityFn };
  return w.clarity ?? null;
}

/** Fires the same event to BOTH Meta Pixel and Clarity, so funnels in
 *  Clarity can use these as steps. */
function track(event: string, params?: Record<string, unknown>) {
  trackCustom(event, params);
  try {
    clarity()?.("event", event, params);
  } catch {
    // ignore — analytics must never break the app
  }
}

/** Standard event: every page/route view. (Clarity tracks page views itself.) */
export function trackPageView() {
  fbq()?.("track", "PageView");
}

/** Micro-conversion: birth details submitted and a Kundli was computed. */
export function trackLead() {
  track("Lead");
}

/** The paywall / pack offer was shown. */
export function trackInitiateCheckout() {
  track("InitiateCheckout");
}

/** The Razorpay payment sheet actually opened. */
export function trackCheckoutOpened() {
  track("CheckoutOpened");
}

/** The checkout was started but never completed. */
export function trackCheckoutAbandoned(reason: "dismissed" | "script_failed" | "failed") {
  track("CheckoutAbandoned", { reason });
}

/** A real pack was paid — value in INR. `eventId` enables Conversions API dedup. */
export function trackPurchase(amountInRupees: number, eventId?: string) {
  const params: Record<string, unknown> = {
    value: amountInRupees,
    currency: "INR",
  };
  if (eventId) params.event_id = eventId;
  fbq()?.("track", "Purchase", params);
  try {
    clarity()?.("event", "Purchase", params);
  } catch {
    // ignore
  }
}

/** Custom event with optional params. */
function trackCustom(event: string, params?: Record<string, unknown>) {
  fbq()?.("trackCustom", event, params);
}

/** Google signup gate completed. */
export function trackSignup() {
  track("Signup");
}

/** First user question got a real answer (activation). */
export function trackFirstAnswer() {
  track("FirstAnswer");
}

/** Free limit reached and the pack offer was shown. */
export function trackPaywallShown() {
  track("PaywallShown");
}

/** A pack tier was selected in the paywall. */
export function trackPackSelected(amountInRupees: number) {
  track("PackSelected", { value: amountInRupees, currency: "INR" });
}

/** The paywall was closed without buying. */
export function trackPaywallDismissed() {
  track("PaywallDismissed");
}

const firedQuestionChips = new Set<string>();

/** A landing question chip was tapped (fires once per question per session). */
export function trackQuestionChip(question: string) {
  if (firedQuestionChips.has(question)) return;
  firedQuestionChips.add(question);
  track("QuestionChip", { q: question });
}
