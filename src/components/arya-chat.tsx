
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { useReportCtx } from "@/hooks/use-report-ctx";
import {
  getDeviceId,
  getOrCreateChatId,
  KUNDLI_KEY,
  newUuid,
  saveKundli,
  setChatId,
} from "@/lib/storage";
import { detectMatchRequest } from "@/lib/match";
import { RASHI, NAKSHATRA, PLANET } from "@/lib/local-names";
import { pickStarters } from "@/lib/starters";
import { reportChatContext } from "@/lib/report";
import {
  trackLead,
  trackInitiateCheckout,
  trackCheckoutOpened,
  trackCheckoutAbandoned,
  trackPurchase,
  trackSignup,
  trackFirstAnswer,
  trackPaywallShown,
  trackPackSelected,
  trackPaywallDismissed,
} from "@/lib/pixel";
import type { Locale } from "@/i18n/routing";
import type { ChatMessage, KundliResult } from "@/lib/types";
import Image from "next/image";
import { ChatMarkdown } from "@/components/chat-markdown";
import { BirthDetailsCard } from "@/components/birth-details-card";
import { MatchCard, type MatchPrefill } from "@/components/match-card";
import { AppNav } from "@/components/app-nav";
import { BackButton } from "@/components/back-button";
import { Send, Gem, Heart, X, ArrowDown, Square } from "lucide-react";
import posthog from "posthog-js";
import {
  findPackInMarket,
  packQuestionsFor,
  packsForCohort,
  BONUS_QUESTIONS,
  type PricingCohort,
  type QuestionPack,
} from "@/lib/pricing";
import {
  formatPrice,
  fromMinorUnits,
  isCurrency,
  toMinorUnits,
  type Currency,
} from "@/lib/money";
import { REGION_CURRENCY, type Region } from "@/lib/geo";

const SIGNED_UP_KEY = "jyotish_signed_up_v1";
const GOOGLE_SUB_KEY = "jyotish_google_sub_v1";
const PAID_Q_KEY = "jyotish_paid_questions_v1";
const ASKED_KEY = "jyotish_asked_count_v1";
const MATCH_KEY = "jyotish_match_v1";
/** Must match QUOTA_EXHAUSTED in @/lib/quota. */
const QUOTA_EXHAUSTED = 402;
const FREE_LIMIT = 3; // Q1 free, Google signup before Q2, paywall after Q3.
// Mirrors FREE_LIMIT in @/lib/quota purely so the paywall can appear without a
// round-trip. The server's copy is the one that actually enforces the limit.

function defaultPackFor(cohort: PricingCohort, currency: Currency): QuestionPack {
  const options = packsForCohort(cohort, currency);
  const index = cohort === "current" && currency === "INR" ? 0 : 1;
  return options[index] ?? options[0];
}

/** Time-of-day greeting bucket, read off the visitor's own clock so the empty
 *  chat opens with the right greeting for their day. */
function heroGreetingKey(
  hour: number
): "heroMorning" | "heroAfternoon" | "heroEvening" | "heroNight" {
  if (hour >= 5 && hour < 12) return "heroMorning";
  if (hour >= 12 && hour < 17) return "heroAfternoon";
  if (hour >= 17 && hour < 21) return "heroEvening";
  return "heroNight";
}

/** Nothing external drives the greeting, so there's nothing to subscribe to. */
const subscribeNoop = () => () => {};

function capturePostHog(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
    posthog.capture(event, properties);
  }
}

/** Loads Razorpay checkout and opens the payment sheet.
 *  Resolves `ok` (payment verified) and `opened` (sheet reached the user —
 *  false means the script failed before the sheet could open). */
function openRazorpay(opts: {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  description: string;
  prefillName?: string;
}): Promise<{ ok: boolean; opened: boolean }> {
  return new Promise((resolve) => {
    let opened = false;
    const settle = (ok: boolean) => resolve({ ok, opened });
    const loadScript = () => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) return init();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = init;
      s.onerror = () => settle(false);
      document.head.appendChild(s);
    };
    const init = () => {
      const R = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void } }).Razorpay;
      if (!R) return settle(false);
      const rzp = new R({
        key: opts.keyId,
        amount: opts.amount,
        currency: opts.currency,
        name: "Jyotish",
        description: opts.description,
        order_id: opts.orderId,
        prefill: opts.prefillName ? { name: opts.prefillName } : undefined,
        remember_customer: true,
        retry: { enabled: true },
        modal: { ondismiss: () => settle(false), confirm_close: true },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const res = await fetch("/api/payment-verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
              body: JSON.stringify(response),
            });
            settle(res.ok);
          } catch {
            settle(false);
          }
        },
      });
      opened = true;
      trackCheckoutOpened();
      capturePostHog("checkout_opened");
      rzp.open();
    };
    loadScript();
  });
}

/** Loads Google Identity Services and renders the Google Sign-In button.
 *  The `initialize` callback captures the credential — there is NO timeout
 *  race, so a user who takes time in the Google popup still gets saved. */
function mountGoogleButton(opts: {
  containerId: string;
  clientId: string;
  onCredential: (credential: string) => void;
}): void {
  const { containerId, clientId, onCredential } = opts;
  const done = () => {
    const g = (window as unknown as {
      google?: {
        accounts?: {
          id?: {
            initialize: (o: {
              client_id: string;
              callback: (r: { credential?: string }) => void;
            }) => void;
            renderButton: (
              el: HTMLElement,
              options: Record<string, unknown>
            ) => void;
          };
        };
      };
    }).google;
    const el = document.getElementById(containerId);
    if (!g?.accounts?.id || !el) return;
    g.accounts.id.initialize({
      client_id: clientId,
      callback: (resp) => {
        if (resp?.credential) onCredential(resp.credential);
      },
    });
    g.accounts.id.renderButton(el, {
      theme: "outline",
      size: "large",
      width: 280,
      text: "continue_with",
    });
  };
  if (document.getElementById("gsi-client")) return done();
  const s = document.createElement("script");
  s.id = "gsi-client";
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.onload = done;
  document.head.appendChild(s);
}

export function AryaChat({
  initialQ,
  initialRegion,
}: {
  initialQ?: string;
  initialRegion?: Region;
}) {
  const t = useTranslations("Chat");
  const tm = useTranslations("Match");
  const tc = useTranslations("Common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const kundli = useKundli();
  const reportCtx = useReportCtx();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [refined, setRefined] = useState(false);
  const [needDetails, setNeedDetails] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [signedUp, setSignedUp] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(SIGNED_UP_KEY) === "1"
  );
  const [paidQuestions, setPaidQuestions] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(PAID_Q_KEY) ?? 0) || 0;
  });
  const [pricingCohort, setPricingCohort] = useState<PricingCohort>("current");
  // Loyalty bonus: server-authoritative. Set from /api/orders and updated by the
  // dismissal endpoint so the bonus appears on the very third dismissal.
  const [bonusEarned, setBonusEarned] = useState(false);
  // Seeded from the server so the first paint already shows the right symbol —
  // a paywall that renders "$9.99" and then flips to "₹50" reads as a bait and
  // switch. /api/orders re-confirms it on mount.
  const initialCurrency = REGION_CURRENCY[initialRegion ?? "IN"];
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const packs = packsForCohort(pricingCohort, currency);
  const [selectedPack, setSelectedPack] = useState<QuestionPack>(() =>
    defaultPackFor("current", initialCurrency)
  );

  const [askedCount, setAskedCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(ASKED_KEY) ?? 0) || 0;
  });
  const [showSignup, setShowSignup] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutRetry, setCheckoutRetry] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    orderId: string;
    packId: string;
    amountMinor: number;
    currency: Currency;
  } | null>(null);

  // Kundli matching state.
  const [matchCard, setMatchCard] = useState<MatchPrefill | null>(null);
  const [matchCardOpen, setMatchCardOpen] = useState(false);
  const [matchKundli, setMatchKundli] = useState<KundliResult | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(MATCH_KEY);
      return raw ? (JSON.parse(raw) as KundliResult) : null;
    } catch {
      return null;
    }
  });
  const [pendingMatch, setPendingMatch] = useState("");

  // Restored-history state (returning users).
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const oldestMsgIdRef = useRef<string | null>(null);
  const paywallPendingRef = useRef<string | null>(null);
  // Guards the checkout from duplicate orders: a ref blocks re-entry while a
  // sheet is opening/attempting, and the state disables the Pay button.
  const checkoutBusyRef = useRef(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only while the user is parked at the bottom. If they scroll up
  // to read, new tokens must not yank the view away from where they're looking.
  const stickToBottomRef = useRef(true);
  // Suppress scroll bookkeeping while a programmatic smooth scroll is in flight
  // so the jump pill doesn't flicker on/off mid-animation.
  const autoScrollUntilRef = useRef(0);
  // The in-flight reply's abort controller, so the Stop button can cancel the
  // stream from outside `streamReply`. Null whenever nothing is streaming.
  const abortRef = useRef<AbortController | null>(null);
  const [showJump, setShowJump] = useState(false);
  const initialSentRef = useRef(false);
  const hasIdentifiedGoogleUserRef = useRef(false);

  // A verified Google subject is the stable account ID. On later page loads the
  // PostHog SDK restores the same identity without requiring another credential.
  useEffect(() => {
    if (
      hasIdentifiedGoogleUserRef.current ||
      !signedUp ||
      !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      !process.env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      return;
    }

    const googleSub = localStorage.getItem(GOOGLE_SUB_KEY);
    if (!googleSub) return;

    posthog.identify(googleSub);
    hasIdentifiedGoogleUserRef.current = true;
  }, [signedUp]);

  /** Increment + persist the asked-question counter so the gate survives refreshes. */
  function bumpAskedCount() {
    setAskedCount((c) => {
      const n = c + 1;
      localStorage.setItem(ASKED_KEY, String(n));
      return n;
    });
  }

  /**
   * Applies the server's authoritative cohort AND currency together. Both
   * change which pack list is valid, so they must land in one state update —
   * applying currency alone would leave `selectedPack` pointing at a pack from
   * a menu that no longer exists.
   */
  function applyPricing(cohort: PricingCohort, nextCurrency: Currency) {
    setPricingCohort(cohort);
    setCurrency(nextCurrency);
    setSelectedPack(defaultPackFor(cohort, nextCurrency));
  }

  /** Restore the user's last thread so returning users keep their history. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/history", {
          headers: { "x-device-id": getDeviceId() },
        });
        const data = await res.json();
        if (cancelled || !data.messages?.length) return;
        setChatId(data.chatId);
        oldestMsgIdRef.current = data.messages[0].id ?? null;
        setMessages(
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as ChatMessage["role"],
            content: m.content,
          }))
        );
        setHasMoreHistory(!!data.hasMore);
      } catch {
        // non-fatal — start fresh
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Reconcile payments on return: if the DB says paid but this device's
   *  localStorage is behind (e.g. webhook-only grant, cleared storage), grant
   *  silently so a paying user is never left gated. Also surfaces any recent
   *  abandoned checkout as a resume-payment banner.
   *
   *  Cross-device: after a Google signup the server resolves the person's
   *  google_sub and returns their paid balance across ALL devices, so a
   *  returning user on a new phone recovers their grants + repeat status. */
  const reconcilePayments = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", {
        headers: { "x-device-id": getDeviceId() },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;

      if (data.paidQuestionsTotal > 0) {
        setPaidQuestions((prev) => {
          const next = Math.max(prev, data.paidQuestionsTotal);
          if (next !== prev) localStorage.setItem(PAID_Q_KEY, String(next));
          return next;
        });
      }
      if (data.pricingCohort === "legacy" || data.pricingCohort === "current") {
        applyPricing(
          data.pricingCohort,
          isCurrency(data.currency) ? data.currency : "INR"
        );
      }
      // Loyalty bonus, server-decided. The client never counts dismissals for
      // the purpose of granting value — it only mirrors what the server says,
      // so a forged localStorage flag earns nothing.
      if (typeof data.bonusEarned === "boolean") {
        setBonusEarned(data.bonusEarned);
      }
      // Adopt the server's metered question count as the local mirror. The
      // local counter only ever grows, so a user who was active before
      // metering existed stayed "out of questions" forever and a verified
      // payment could not get them back in. The server is the authority; this
      // cache must be corrected from it, not merely kept above it.
      if (typeof data.usedQuestions === "number") {
        setAskedCount(data.usedQuestions);
        localStorage.setItem(ASKED_KEY, String(data.usedQuestions));
      }
      if (data.pending) {
        setPendingOrder({
          orderId: data.pending.orderId,
          packId: data.pending.packId,
          amountMinor: Number(data.pending.amountMinor) || 0,
          currency: isCurrency(data.pending.currency)
            ? data.pending.currency
            : "INR",
        });
      }
    } catch {
      // non-fatal — reconciliation is best-effort
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/orders", {
          headers: { "x-device-id": getDeviceId() },
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!data) return;
        if (data.paidQuestionsTotal > 0) {
          setPaidQuestions((prev) => {
            const next = Math.max(prev, data.paidQuestionsTotal);
            if (next !== prev) localStorage.setItem(PAID_Q_KEY, String(next));
            return next;
          });
        }
        if (data.pricingCohort === "legacy" || data.pricingCohort === "current") {
          applyPricing(
            data.pricingCohort,
            isCurrency(data.currency) ? data.currency : "INR"
          );
        }
        if (typeof data.usedQuestions === "number") {
          setAskedCount(data.usedQuestions);
          localStorage.setItem(ASKED_KEY, String(data.usedQuestions));
        }
        if (data.pending) {
          setPendingOrder({
            orderId: data.pending.orderId,
            packId: data.pending.packId,
            amountMinor: Number(data.pending.amountMinor) || 0,
            currency: isCurrency(data.pending.currency)
              ? data.pending.currency
              : "INR",
          });
        }
      } catch {
        // non-fatal
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadEarlier() {
    if (!oldestMsgIdRef.current || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const res = await fetch(`/api/history?before=${oldestMsgIdRef.current}`, {
        headers: { "x-device-id": getDeviceId() },
      });
      const data = await res.json();
      if (data.messages?.length) {
        oldestMsgIdRef.current = data.messages[0].id ?? oldestMsgIdRef.current;
        setMessages((prev) => [
          ...data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as ChatMessage["role"],
            content: m.content,
          })),
          ...prev,
        ]);
        setHasMoreHistory(!!data.hasMore);
      } else {
        setHasMoreHistory(false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEarlier(false);
    }
  }

  /** Jump to the latest message and re-arm auto-follow. */
  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const el = bodyRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJump(false);
    if (behavior === "smooth") autoScrollUntilRef.current = Date.now() + 600;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  /** Track whether the user is reading near the bottom; offer a jump pill if not. */
  function handleBodyScroll() {
    const el = bodyRef.current;
    if (!el) return;
    if (Date.now() < autoScrollUntilRef.current) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 80;
    stickToBottomRef.current = atBottom;
    setShowJump((prev) => (prev === !atBottom ? prev : !atBottom));
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    // While streaming, follow instantly (the CSS smooth-scroll would otherwise
    // re-animate on every token and fight the user). Smooth only for one-offs.
    scrollToBottom(streaming ? "instant" : "smooth");
  }, [messages, streaming, needDetails]);

  /** Stream one exchange; `display` is what's shown (user bubble already added). */
  async function streamReply(
    apiMessages: ChatMessage[],
    display: ChatMessage[],
    chart: KundliResult | null = kundli,
    matchChart: KundliResult | null = matchKundli
  ) {
    const chatId = getOrCreateChatId();
    const messageId = newUuid();

    // One controller per in-flight reply. Every streaming path funnels through
    // here, so a single ref gives all of them a working Stop.
    //
    // Stopping is a CLIENT-side stop only: /api/chat finishes generating and
    // persists the exchange regardless of whether we are still listening, so
    // pressing Stop can never leave a half-written turn in history.
    const controller = new AbortController();
    abortRef.current = controller;
    let stopped = false;

    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          kundli: chart,
          messages: apiMessages,
          lang: locale,
          chatId,
          messageId,
          matchKundli: matchChart ?? undefined,
          reportSummary: reportCtx ? reportChatContext(reportCtx) : undefined,
        }),
      });
    } catch (err) {
      abortRef.current = null;
      if ((err as Error).name === "AbortError") {
        // Stopped before the first byte: drop the empty assistant bubble rather
        // than leaving a blank message on screen.
        setMessages(display);
        capturePostHog("chat_response_stopped");
        return;
      }
      throw err;
    }

    // The server is the authority on the free limit. If it says the quota is
    // spent, the local counter was wrong (cleared storage, a device switch) —
    // open the paywall and hold the question so it auto-sends after purchase,
    // rather than surfacing a raw HTTP error at the user.
    if (res.status === QUOTA_EXHAUSTED) {
      paywallPendingRef.current = display[display.length - 1]?.content ?? "";
      // Roll back the optimistic user bubble. `sendTextAfterPaywall` re-adds it
      // after purchase, and without this the question would appear twice.
      setMessages(display.slice(0, -1));
      setAskedCount((c) => {
        const n = Math.max(0, c - 1);
        localStorage.setItem(ASKED_KEY, String(n));
        return n;
      });
      setCheckoutRetry(false);
      openPaywall();
      return;
    }

    if (!res.ok || !res.body) throw new Error("Bad response");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const MARKER = "\n[[REFINED]]\n";
    let acc = "";

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // AbortError: the user pressed Stop. Keep whatever already streamed —
        // throwing here would replace a usable partial answer with an error.
        stopped = true;
        break;
      }
      const { done, value } = chunk;
      if (done) break;
      acc += decoder.decode(value, { stream: true });

      const idx = acc.indexOf(MARKER);
      if (idx >= 0) {
        setMessages([...display, { role: "assistant", content: acc.slice(0, idx).trim() }]);
        setRefined(true);
        acc = acc.slice(idx + MARKER.length);
      } else {
        setMessages([...display, { role: "assistant", content: acc }]);
      }
    }

    abortRef.current = null;
    // Stopped with nothing received yet → remove the blank bubble. Otherwise keep
    // the partial answer, which is what every AI chat does on stop.
    if (stopped && !acc.trim()) {
      setMessages(display);
      capturePostHog("chat_response_stopped");
      return;
    }
    setMessages([...display, { role: "assistant", content: acc }]);
    capturePostHog(stopped ? "chat_response_stopped" : "chat_response_received");
  }

  /** Stop the streaming answer. The partial text stays on screen. */
  function stopStreaming() {
    abortRef.current?.abort();
  }

  /** Send a question (used by input + chips + carried-from-landing question). */
  async function sendText(content: string) {
    const text = content.trim();
    if (!text || streaming) return;
    stickToBottomRef.current = true;
    setRefined(false);

    // Chat-only flow: no chart yet → ask for details inside the chat.
    if (!kundli) {
      setNeedDetails(true);
      setPendingQuestion(text);
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages([...next, { role: "assistant", content: t("needDetails") }]);
      return;
    }

    // Kundli matching: if the message carries another person's birth details,
    // open the match card (pre-filled) instead of answering from one chart.
    const detected = detectMatchRequest(text, kundli.profile.date);
    if (detected) {
      setMatchCard({ name: detected.name, date: detected.date, time: detected.time });
      setMatchCardOpen(true);
      setPendingMatch(text);
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages([...next, { role: "assistant", content: tm("matchPrompt") }]);
      return;
    }

    // Q1 free → Google login before Q2 → two more free questions → paywall.
    if (!signedUp && askedCount >= 1) {
      setShowSignup(true);
      return;
    }
    // Out of questions → offer the packs. The client only pre-empts the paywall
    // for users with NO purchased credits, whose limit is purely FREE_LIMIT and
    // whose local counter is authoritative enough to save a round-trip. For
    // anyone who has ever paid, the SERVER decides: a stale or pre-metering
    // local count must never lock out a customer whose payment was verified. If
    // the server says the quota is spent, its 402 opens the paywall with the
    // question held (see streamReply) — same outcome, without trusting a cache.
    if (paidQuestions === 0 && askedCount >= FREE_LIMIT) {
      paywallPendingRef.current = text;
      setCheckoutRetry(false);
      openPaywall();
      return;
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    capturePostHog("chat_question_submitted", { question_number: askedCount + 1 });
    bumpAskedCount();
    setStreaming(true);
    try {
      await streamReply(next, next);
      maybeFireFirstAnswer();
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", content: `[Error: ${(err as Error).message}]` },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  async function send() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    await sendText(content);
  }

  /** Real Google signup — the credential arrives from the rendered button's
   *  callback and is saved on the profile (email/name/sub). */
  /**
   * Rejoin a returning user to their own chart instead of making them retype
   * their birth details.
   *
   * Two things are lost when someone arrives on a new phone or after clearing
   * site data, and both are recoverable server-side: the chart (stored in
   * `profiles.kundli_json`) and their signed-up status (`signed_up_at`). The
   * signed-up one matters commercially — reading it from localStorage alone
   * means an existing customer is shown the Google gate again, which is the
   * "locked out despite paying" failure this codebase treats as the worst
   * outcome.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Nothing to restore if this device already has both.
      if (kundli && signedUp) return;
      try {
        const res = await fetch("/api/me", {
          headers: { "x-device-id": getDeviceId() },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data?.signedUp && !signedUp) {
          setSignedUp(true);
          localStorage.setItem(SIGNED_UP_KEY, "1");
        }
        if (data?.hasKundli && data.kundli && !kundli) {
          saveKundli(data.kundli as KundliResult);
          // useKundli subscribes to cross-tab `storage` events only, so a
          // plain save would leave this component rendering an empty chart.
          window.dispatchEvent(new StorageEvent("storage", { key: KUNDLI_KEY }));
        }
      } catch {
        // Fail soft: worst case is today's behaviour.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kundli, signedUp]);

  async function completeGoogleSignup(credential: string) {
    setSignedUp(true);
    localStorage.setItem(SIGNED_UP_KEY, "1");
    setShowSignup(false);
    trackSignup();
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ credential, lang: locale }),
      });
      const data = await response.json().catch(() => null);
      const user = data?.user as
        | { id: string; email: string; name: string }
        | null
        | undefined;

      if (response.ok && user?.id) {
        localStorage.setItem(GOOGLE_SUB_KEY, user.id);
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
          posthog.identify(user.id, { email: user.email, name: user.name });
          hasIdentifiedGoogleUserRef.current = true;
        }
        capturePostHog("signup_completed");
      }

      // Recover cross-device purchases: now that this device is linked to the
      // user's Google identity, pull any paid balance from their other devices
      // (returning buyer on a new phone stays ungated + keeps repeat status).
      void reconcilePayments();
    } catch {
      // non-fatal
    }
  }

  // Mount the real Google Sign-In button whenever the gate opens.
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (showSignup && clientId) {
      mountGoogleButton({
        containerId: "gsi-signup-button",
        clientId,
        onCredential: (cred) => void completeGoogleSignup(cred),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSignup]);

  /** Buy the selected pack — real Razorpay checkout when keys are set. */
  async function buyPack() {
    // Lock against duplicate orders: a second tap while a sheet is opening or
    // attempting must not create another order (Razorpay attempts:0 spam).
    if (checkoutBusyRef.current) return;
    checkoutBusyRef.current = true;
    setCheckoutBusy(true);
    setShowPaywall(false);
    trackInitiateCheckout();
    capturePostHog("checkout_started", {
      pack_tier: selectedPack.tier,
      question_credits: selectedPack.questions,
      price: selectedPack.price,
      currency: selectedPack.currency,
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "x-device-id": getDeviceId() },
        body: JSON.stringify({
          packTier: selectedPack.tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("checkout_failed", data);
        throw new Error("checkout_failed");
      }

      if (data.simulated) {
        // Experiment path: grant immediately, but do NOT fire a Purchase event —
        // no real money changed hands, so it would pollute Meta's data.
        grantPack(data.pack?.questions ?? selectedPack.questions, false);
        return;
      }
      const result = await openRazorpay({
        ...data,
        description: `${data.pack?.questions ?? selectedPack.questions} questions with Arya`,
        prefillName: kundli?.profile.name,
      });
      if (result.ok) {
        setPendingOrder(null);
        grantPack(
          data.pack?.questions ?? selectedPack.questions,
          true,
          data.amount,
          data.currency ?? selectedPack.currency,
          data.orderId
        );
      } else {
        // Payment sheet was dismissed or failed — never leave the user in
        // a dead end. Reopen the paywall with a retry note; the held question
        // stays pending so they can finish right away. Mark the order
        // `attempted` so it isn't surfaced as a stale resume candidate.
        trackCheckoutAbandoned(result.opened ? "dismissed" : "script_failed");
        // Mark failed ONLY when the sheet actually opened and was dismissed —
        // that order had a real (missed) chance. If the sheet never opened
        // (script_failed), leave it `created` so the next Pay click REUSES the
        // same order instead of spawning a duplicate (idempotency).
        if (result.opened && data.orderId) {
          void fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
            body: JSON.stringify({ orderId: data.orderId }),
          }).catch(() => {});
        }
        setCheckoutRetry(true);
        setShowPaywall(true);
      }
    } catch {
      trackCheckoutAbandoned("failed");
      setCheckoutRetry(true);
      setShowPaywall(true);
    } finally {
      // Release the checkout lock in every path — a dismiss or failure must
      // leave the Pay button re-enabled so the user can retry.
      checkoutBusyRef.current = false;
      setCheckoutBusy(false);
    }
  }

  /** Resume an abandoned checkout: reopen the paywall pre-selected to the
   *  pack they had chosen, so a retry is one tap away.
   *
   *  Scoped to the CURRENT market on purpose. An abandoned order is not
   *  resumable across markets — the id means nothing in this menu, so adopting
   *  it would highlight no option while quoting a price the checkout would not
   *  charge (EU order resumed from the US would say "Pay €10.99" and bill
   *  $9.99). Pre-change ids like `p20` predate currency scoping and likewise
   *  don't match; in both cases we fall back to this market's standard pack,
   *  and the banner still shows the amount they actually abandoned. */
  function resumePayment() {
    setSelectedPack(
      findPackInMarket(pricingCohort, currency, pendingOrder?.packId) ??
        defaultPackFor(pricingCohort, currency)
    );
    setShowPaywall(true);
  }

  /** Open the paywall with the default pack selected for this market. */
  function openPaywall() {
    setSelectedPack(defaultPackFor(pricingCohort, currency));
    setShowPaywall(true);
  }

  function grantPack(
    questions: number,
    real = true,
    amountMinor?: number,
    currency?: string,
    eventId?: string
  ) {
    // Cumulative — repeat purchases add to the balance, never reset it.
    setPaidQuestions((prev) => {
      const next = prev + questions;
      localStorage.setItem(PAID_Q_KEY, String(next));
      return next;
    });
    if (real) {
      // Value = the ACTUAL order amount paid, converted out of minor units with
      // the order's own currency — never a hardcoded figure and never a blind
      // /100, which would be wrong for any non-2-decimal currency.
      //
      // The checkout response is the only source of truth here. It is NOT
      // derived from `selectedPack`: if those ever disagree (a resumed order
      // from another market, a stale selection) the card was charged the
      // SERVER's amount, and Meta must be told that same amount — reporting the
      // pack's price instead would corrupt every revenue metric.
      const paidCurrency = isCurrency(currency) ? currency : "INR";
      const minor = amountMinor ?? toMinorUnits(selectedPack.price, paidCurrency);
      const value = fromMinorUnits(minor, paidCurrency);
      // event_id = Razorpay order id → dedupes with CAPI in Meta.
      trackPurchase(value, paidCurrency, eventId ?? newUuid());
      capturePostHog("payment_completed", {
        pack_tier: selectedPack.tier,
        question_credits: questions,
        price: value,
        currency: paidCurrency,
      });
    }
    setPendingOrder(null);
    // The user landed on the paywall with a question in hand — send it now that
    // they've paid, so they stay in the same spot instead of being dropped.
    const pending = paywallPendingRef.current;
    paywallPendingRef.current = null;
    if (pending) {
      void sendTextAfterPaywall(pending);
    }
  }

  /** Send a question without re-checking the gates (used right after a purchase). */
  async function sendTextAfterPaywall(text: string) {
    const content = text.trim();
    if (!content || streaming || !kundli) return;
    stickToBottomRef.current = true;
    setRefined(false);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    capturePostHog("chat_question_submitted", { question_number: askedCount + 1 });
    bumpAskedCount();
    setStreaming(true);
    try {
      await streamReply(next, next);
      maybeFireFirstAnswer();
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", content: `[Error: ${(err as Error).message}]` },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => {
    if (showPaywall) trackPaywallShown();
  }, [showPaywall]);

  /** Fires once — the first user question that gets a real answer. */
  const firstAnswerFiredRef = useRef(false);
  function maybeFireFirstAnswer() {
    if (firstAnswerFiredRef.current) return;
    firstAnswerFiredRef.current = true;
    trackFirstAnswer();
  }

  /** After the in-chat details form computes the chart: answer the pending question. */
  async function onDetailsComplete(newKundli: KundliResult) {
    saveKundli(newKundli);
    trackLead();
    capturePostHog("chat_birth_chart_generated");
    const question = pendingQuestion;
    const display = messages;
    setNeedDetails(false);
    setPendingQuestion("");
    capturePostHog("chat_question_submitted", {
      question_number: askedCount + 1,
      source: "birth_details",
    });
    bumpAskedCount();
    setStreaming(true);
    try {
      await streamReply([{ role: "user", content: question }], display, newKundli);
      maybeFireFirstAnswer();
    } catch {
      // ignore
    } finally {
      setStreaming(false);
    }
  }

  /** After the match card computes the partner chart: answer the held question. */
  async function onMatchComplete(partner: KundliResult) {
    setMatchKundli(partner);
    localStorage.setItem(MATCH_KEY, JSON.stringify(partner));
    capturePostHog("match_chart_generated");
    const question = pendingMatch;
    const display = messages;
    setMatchCard(null);
    setMatchCardOpen(false);
    setPendingMatch("");
    capturePostHog("chat_question_submitted", {
      question_number: askedCount + 1,
      source: "match_details",
    });
    bumpAskedCount();
    setStreaming(true);
    try {
      await streamReply([{ role: "user", content: question }], display, kundli, partner);
      maybeFireFirstAnswer();
    } catch {
      // ignore
    } finally {
      setStreaming(false);
    }
  }

  function clearMatch() {
    setMatchKundli(null);
    setMatchCard(null);
    setMatchCardOpen(false);
    localStorage.removeItem(MATCH_KEY);
  }

  // If a question was carried from the landing, auto-send it (once history is restored).
  useEffect(() => {
    if (!kundli || !historyLoaded) return;
    const timer = setTimeout(() => {
      if (initialQ && !initialSentRef.current) {
        initialSentRef.current = true;
        void sendText(initialQ);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundli, historyLoaded]);

  // Instant deterministic chart-at-a-glance (no LLM, <1s).
  const glance =
    kundli && !needDetails
      ? `${t("glance")}: Lagna ${RASHI[locale][kundli.computed.lagnaRashi]} · Moon ${
          RASHI[locale][kundli.computed.moonRashi]
        } (${NAKSHATRA[locale][kundli.computed.moonNakshatra]}) · Sun ${
          RASHI[locale][kundli.computed.sunRashi]
        } · Mahadasha ${
          PLANET[locale][
            kundli.dasha.periods.find((p) => p.current)?.lord.toLowerCase() ?? ""
          ] ?? ""
        }\n\n${t("glanceAsk")}`
      : null;

  // Starter chips — shown from the very start (empty chat) and after each reply.
  const showStarters =
    !!kundli &&
    !needDetails &&
    !streaming &&
    (messages.length === 0 || messages[messages.length - 1]?.role === "assistant");

  // Empty-chat hero: a warm welcome instead of a bare label.
  const emptyChat = messages.length === 0 && !needDetails;

  // Resolved client-side only — `getServerSnapshot` returns null, so the
  // server HTML carries no hero and hydration can't mismatch on the clock.
  const heroKey = useSyncExternalStore<ReturnType<typeof heroGreetingKey> | null>(
    subscribeNoop,
    () => heroGreetingKey(new Date().getHours()),
    () => null
  );

  const heroName = kundli?.profile?.name?.trim() ?? "";

  const starters = useMemo(() => {
    if (!showStarters) return [];
    const asked = new Set<string>();
    const context: string[] = [];
    for (const m of messages) {
      if (m.role === "user") {
        asked.add(m.content.trim());
        context.push(m.content);
      } else {
        context.push(m.content);
      }
    }
    return pickStarters(context.join(" "), locale, asked);
  }, [messages, showStarters, locale]);

  // Teaser → one-tap continuation: the last question-sentence of the latest
  // answer becomes a tappable chip, so the next step is one tap, not typing.
  const teaser = useMemo(() => {
    if (!showStarters) return null;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return null;
    const sentences = last.content
      .split(/(?<=[.?!।])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const candidate = (sentences[sentences.length - 1] ?? "")
      .replace(/[*_#`]/g, "")
      .trim();
    if (!candidate.endsWith("?") || candidate.length > 100) return null;
    const alreadyAsked = messages.some(
      (m) => m.role === "user" && m.content === candidate
    );
    return alreadyAsked ? null : candidate;
  }, [messages, showStarters]);

  return (
    <div className="chat-view">
      <header className="chat-header">
        <BackButton className="back-btn--hdr" hideWhenNoHistory />
        <span className="chat-header__avatar">
          <Image src="/arays.png" alt="AI" fill sizes="64px" className="avatar-img" />
        </span>
        <div className="chat-header__body">
          <span className="chat-header__name">{t("title")}</span>
          <span className="chat-header__status">{t("status")}</span>
        </div>
        {kundli && (
          <button
            className="chat-header__chart"
            onClick={() => router.push("/kundli")}
            aria-label={t("chart")}
          >
            <Gem size={17} />
          </button>
        )}
      </header>

      <div
        className={`chat-body${emptyChat ? " chat-body--empty" : ""}`}
        ref={bodyRef}
        onScroll={handleBodyScroll}
      >
        {emptyChat && heroKey ? (
          <div className="chat-hero">
            <h1 className="chat-hero__title">
              {heroName ? `${t(heroKey)}, ${heroName}` : t(heroKey)}
            </h1>
            <p className="chat-hero__sub">{t("heroAsk")}</p>
          </div>
        ) : !emptyChat ? (
          <div className="welcome-chip">{t("welcome")}</div>
        ) : null}

        {hasMoreHistory && (
          <button
            className="chip history-more"
            onClick={() => void loadEarlier()}
            disabled={loadingEarlier}
          >
            {loadingEarlier ? "…" : "↑ " + t("historyMore")}
          </button>
        )}

        {glance && (
          <div className="msg msg--ai msg--glance">
            <ChatMarkdown>{glance}</ChatMarkdown>
          </div>
        )}

        {messages.map((m, i) =>
          m.content ? (
            <div
              key={i}
              className={`msg ${m.role === "user" ? "msg--user" : "msg--ai"}`}
            >
              {m.role === "user" ? (
                m.content
              ) : (
                <ChatMarkdown>{m.content}</ChatMarkdown>
              )}
              {refined && m.role === "assistant" && i === messages.length - 1 && (
                <div className="refined-chip">✓ {t("autoChecked")}</div>
              )}
            </div>
          ) : null
        )}

        {needDetails && !kundli && (
          <div className="birth-card-wrap">
            <BirthDetailsCard onComplete={onDetailsComplete} />
          </div>
        )}

        {matchCardOpen && kundli && (
          <div className="birth-card-wrap">
            <MatchCard
              prefill={matchCard ?? undefined}
              onComplete={onMatchComplete}
              onCancel={() => {
                setMatchCardOpen(false);
                setMatchCard(null);
              }}
            />
          </div>
        )}

        {showStarters && (teaser || starters.length > 0 || (reportCtx && messages.length === 0)) && (
          <div className="starter-chips">
            {reportCtx && messages.length === 0 && (
              <button
                className="chip chip--report"
                onClick={() => void sendText(t("reportChip"))}
              >
                {t("reportChip")}
              </button>
            )}
            {teaser && (
              <button className="chip chip--teaser" onClick={() => void sendText(teaser)}>
                {teaser}
              </button>
            )}
            {starters.map((q) => (
              <button key={q} className="chip" onClick={() => void sendText(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {kundli && !needDetails && !matchCardOpen && (
          <div className="match-row">
            {matchKundli ? (
              <div className="match-bar">
                <Heart size={13} />
                <span>
                  {tm("matchingWith")} {matchKundli.profile.name || "Partner"} ·{" "}
                  {matchKundli.computed.moonNakshatra !== undefined ? RASHI[locale][matchKundli.computed.moonRashi] : ""}
                </span>
                <button className="match-bar__clear" onClick={clearMatch} aria-label={tm("clear")}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                className="chip match-chip"
                onClick={() => {
                  setMatchCard({});
                  setMatchCardOpen(true);
                }}
              >
                <Heart size={13} /> {tm("matchChip")}
              </button>
            )}
          </div>
        )}

        {streaming && (
          <div className="msg msg--typing">
            <span className="dot-anim">●</span>
            <span className="dot-anim">●</span>
            <span className="dot-anim">●</span>
            <span style={{ marginLeft: 6 }}>{t("thinking")}</span>
          </div>
        )}
      </div>

      {showJump && (
        <button
          className="chat-jump"
          onClick={() => scrollToBottom()}
          aria-label={t("scrollToLatest")}
        >
          <ArrowDown size={14} />
        </button>
      )}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={1}
          value={input}
          placeholder={t("inputPlaceholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {/* While Arya is answering, this becomes Stop — the same affordance
            ChatGPT and friends use. It used to be a permanently disabled send
            button, which gave a tap no feedback at all; Clarity recorded those
            as dead clicks and then rage clicks. A control that does something
            is strictly better than one that does nothing. */}
        {streaming ? (
          <button
            className="chat-send chat-send--stop"
            onClick={stopStreaming}
            aria-label={t("stop")}
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            className="chat-send"
            onClick={send}
            disabled={!input.trim()}
            aria-label={t("send")}
          >
            <Send size={18} />
          </button>
        )}
      </div>

      {pendingOrder && (
        <div className="pending-banner">
          <span className="pending-banner__text">
            {t("pendingBanner")} (
              {formatPrice(
                fromMinorUnits(pendingOrder.amountMinor, pendingOrder.currency),
                pendingOrder.currency
              )}
            )
          </span>
          <button className="pending-banner__pay" onClick={resumePayment}>
            {t("pendingPay")}
          </button>
          <button
            className="pending-banner__close"
            onClick={() => setPendingOrder(null)}
            aria-label={tc("close")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <AppNav inline />

      {showSignup && (
        <div className="gate-modal">
          <div className="gate-modal__card">
            <span className="gate-modal__g">G</span>
            <h2 className="gate-modal__title">{t("signupTitle")}</h2>
            <p className="gate-modal__sub">{t("signupSub")}</p>
            <div
              id="gsi-signup-button"
              className="gsi-signup-button"
            />
            <p className="gate-modal__legal">
              {t("agree")}{" "}
              <Link href="/legal/privacy">{t("agreePrivacy")}</Link>
              {" · "}
              <Link href="/legal/terms">{t("agreeTerms")}</Link>
            </p>
            <button
              className="gate-modal__ghost"
              onClick={() => setShowSignup(false)}
            >
              {t("notNow")}
            </button>
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="gate-modal">
          <div className="gate-modal__card">
            <h2 className="gate-modal__title">{t("paywallTitle")}</h2>
            <p className="gate-modal__sub">{t("paywallSub")}</p>
            {checkoutRetry && <p className="gate-modal__retry">{t("checkoutRetry")}</p>}

            <div className="pack-list">
              {packs.map((p) => {
                const shownQuestions = packQuestionsFor(
                  pricingCohort,
                  p,
                  bonusEarned
                );
                const hasBonus = shownQuestions > p.questions;
                return (
                  <button
                    key={p.id}
                    className={`pack-option ${
                      selectedPack.id === p.id ? "pack-option--on" : ""
                    }`}
                    onClick={() => {
                      setSelectedPack(p);
                      trackPackSelected(p.price, p.currency);
                      capturePostHog("question_pack_selected", {
                        pack_tier: p.tier,
                        question_credits: shownQuestions,
                        price: p.price,
                        currency: p.currency,
                      });
                    }}
                  >
                    <span className="pack-option__price">
                      {formatPrice(p.price, p.currency)}
                    </span>
                    <span className="pack-option__q">
                      {`${shownQuestions} ${t("packQ")}`}
                      {hasBonus && (
                        <span className="badge badge--bonus">
                          {t("packBonus", { n: shownQuestions - p.questions })}
                        </span>
                      )}
                    </span>
                    {p.popular && (
                      <span className="badge badge--popular">{t("packBadge")}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {bonusEarned && (
              <p className="gate-modal__bonus">
                {t("paywallBonusNote", { n: BONUS_QUESTIONS })}
              </p>
            )}

            <button
              className="btn btn--gold"
              onClick={buyPack}
              disabled={checkoutBusy}
              style={checkoutBusy ? { opacity: 0.6, pointerEvents: "none" } : undefined}
            >
              {checkoutBusy
                ? t("paying")
                : `${t("payBtn")} ${formatPrice(
                    selectedPack.price,
                    selectedPack.currency
                  )}`}
            </button>
            <button
              className="gate-modal__ghost"
              onClick={() => {
                paywallPendingRef.current = null;
                setShowPaywall(false);
                trackPaywallDismissed();
                // Also a PostHog event: it is the trigger for the
                // "what stopped you buying?" survey, so it has to be captured
                // at the exact moment the paywall is dismissed.
                capturePostHog("paywall_dismissed", {
                  questions_used: askedCount,
                });
                // Tell the server this was a dismissal. After the threshold it
                // replies with the earned entitlement, so the bonus appears on
                // the very next open instead of waiting for a page reload. The
                // response — not the client's own count — decides.
                void (async () => {
                  try {
                    const res = await fetch("/api/paywall/dismiss", {
                      method: "POST",
                      headers: { "x-device-id": getDeviceId() },
                    });
                    if (!res.ok) return;
                    const data = await res.json();
                    if (typeof data?.earned === "boolean") {
                      setBonusEarned(data.earned);
                    }
                  } catch {
                    // Non-fatal: the bonus simply is not revealed until the
                    // next /api/orders reconcile.
                  }
                })();
              }}
            >
              {t("notNow")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
