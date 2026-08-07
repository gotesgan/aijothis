"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { getDeviceId, getOrCreateChatId, newUuid, saveKundli, setChatId } from "@/lib/storage";
import { detectMatchRequest } from "@/lib/match";
import { RASHI, NAKSHATRA, PLANET } from "@/lib/local-names";
import { pickStarters } from "@/lib/starters";
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
import { Send, Gem, Heart, X } from "lucide-react";

const SIGNED_UP_KEY = "jyotish_signed_up_v1";
const PAID_Q_KEY = "jyotish_paid_questions_v1";
const ASKED_KEY = "jyotish_asked_count_v1";
const MATCH_KEY = "jyotish_match_v1";
const UNLIMITED_KEY = "jyotish_unlimited_until_v1";
const FREE_LIMIT = 5; // 1 free + 2 login-gated + 2 more, then paywall
const UNLIMITED_DAYS = 7; // repeat-buyer pass: unlimited questions for a week

interface QuestionPack {
  id: string;
  price: number;
  questions: number;
  popular?: boolean;
  unlimited?: boolean;
}

/** Pack menu — ₹10 to ₹30, more value per rupee at higher tiers. */
const PACKS: QuestionPack[] = [
  { id: "p10", price: 10, questions: 10 },
  { id: "p20", price: 20, questions: 30, popular: true },
  { id: "p30", price: 30, questions: 50 },
];

/** Repeat-buyer only: ₹60 for unlimited questions over a week. */
const UNLIMITED_PACK: QuestionPack = {
  id: "p60",
  price: 60,
  questions: 0,
  unlimited: true,
};

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

export function AryaChat({ initialQ }: { initialQ?: string }) {
  const t = useTranslations("Chat");
  const tm = useTranslations("Match");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const kundli = useKundli();

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
  const [unlimitedUntil, setUnlimitedUntil] = useState(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(UNLIMITED_KEY);
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts > Date.now() ? raw : null;
  });
  const [selectedPack, setSelectedPack] = useState<QuestionPack>(PACKS[1]);
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
    amountPaise: number;
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

  const bodyRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  /** Increment + persist the asked-question counter so the gate survives refreshes. */
  function bumpAskedCount() {
    setAskedCount((c) => {
      const n = c + 1;
      localStorage.setItem(ASKED_KEY, String(n));
      return n;
    });
  }

  /** Repeat-buyer pass is active while `unlimitedUntil` is in the future. */
  function isUnlimited(): boolean {
    return !!unlimitedUntil && new Date(unlimitedUntil).getTime() > Date.now();
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
   *  abandoned checkout as a resume-payment banner. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orders", {
          headers: { "x-device-id": getDeviceId() },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        if (data.paidQuestionsTotal > 0) {
          setPaidQuestions((prev) => {
            const next = Math.max(prev, data.paidQuestionsTotal);
            if (next !== prev) localStorage.setItem(PAID_Q_KEY, String(next));
            return next;
          });
        }
        if (data.hasP60 && data.latestPaidAt) {
          setUnlimitedUntil(() => {
            const existing = localStorage.getItem(UNLIMITED_KEY);
            if (existing && new Date(existing).getTime() > Date.now()) return existing;
            const until = new Date(
              new Date(data.latestPaidAt).getTime() + UNLIMITED_DAYS * 24 * 60 * 60 * 1000
            ).toISOString();
            localStorage.setItem(UNLIMITED_KEY, until);
            return until;
          });
        }
        if (data.pending) {
          setPendingOrder(data.pending);
        }
      } catch {
        // non-fatal — reconciliation is best-effort
      }
    })();
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

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
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
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getDeviceId(),
      },
      body: JSON.stringify({
        kundli: chart,
        messages: apiMessages,
        lang: locale,
        chatId,
        messageId,
        matchKundli: matchChart ?? undefined,
      }),
    });

    if (!res.ok || !res.body) throw new Error("Bad response");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const MARKER = "\n[[REFINED]]\n";
    let acc = "";

    while (true) {
      const { done, value } = await reader.read();
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

    setMessages([...display, { role: "assistant", content: acc }]);
  }

  /** Send a question (used by input + chips + carried-from-landing question). */
  async function sendText(content: string) {
    const text = content.trim();
    if (!text || streaming) return;
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

    // Experiment tiers: Q1 free → Google login before Q2 → paywall after 5.
    if (!signedUp && askedCount >= 1) {
      setShowSignup(true);
      return;
    }
    const limit = FREE_LIMIT + paidQuestions;
    if (!isUnlimited() && askedCount >= limit) {
      // Out of questions (free or bought) → always offer the packs so the user
      // can keep buying as many times as they want. No dead-end.
      // Hold the question so it can auto-send right after the purchase.
      paywallPendingRef.current = text;
      setCheckoutRetry(false);
      setShowPaywall(true);
      return;
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
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
  async function completeGoogleSignup(credential: string) {
    setSignedUp(true);
    localStorage.setItem(SIGNED_UP_KEY, "1");
    setShowSignup(false);
    trackSignup();
    try {
      await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ credential, lang: locale }),
      });
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
    setShowPaywall(false);
    trackInitiateCheckout();
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "x-device-id": getDeviceId() },
        body: JSON.stringify({
          amountPaise: selectedPack.price * 100,
          packId: selectedPack.id,
          packQuestions: selectedPack.questions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Order failed");

      if (data.simulated) {
        // Experiment path: grant immediately, but do NOT fire a Purchase event —
        // no real money changed hands, so it would pollute Meta's data.
        if (selectedPack.unlimited) grantUnlimited(false);
        else grantPack(selectedPack.questions, false);
        return;
      }
      const result = await openRazorpay({
        ...data,
        description: selectedPack.unlimited
          ? "7-day unlimited questions with Arya"
          : `${selectedPack.questions} questions with Arya`,
        prefillName: kundli?.profile.name,
      });
      if (result.ok) {
        setPendingOrder(null);
        if (selectedPack.unlimited) grantUnlimited(true, data.amount);
        else grantPack(selectedPack.questions, true, data.amount);
      } else {
        // Payment sheet was dismissed or never opened — never leave the user in
        // a dead end. Reopen the paywall with a retry note; the held question
        // stays pending so they can finish right away.
        trackCheckoutAbandoned(result.opened ? "dismissed" : "script_failed");
        setCheckoutRetry(true);
        setShowPaywall(true);
      }
    } catch {
      trackCheckoutAbandoned("failed");
      setCheckoutRetry(true);
      setShowPaywall(true);
    }
  }

  /** Resume an abandoned checkout: reopen the paywall pre-selected to the
   *  pack they had chosen, so a retry is one tap away. */
  function resumePayment() {
    if (pendingOrder) {
      const match = [...PACKS, UNLIMITED_PACK].find((p) => p.id === pendingOrder.packId);
      if (match) setSelectedPack(match);
    }
    setShowPaywall(true);
  }

  /** Repeat-buyer pass: unlimited questions until 7 days from now. */
  function grantUnlimited(real = true, amountPaise?: number) {
    setUnlimitedUntil(() => {
      const until = new Date(
        Date.now() + UNLIMITED_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      localStorage.setItem(UNLIMITED_KEY, until);
      return until;
    });
    if (real) {
      trackPurchase((amountPaise ?? UNLIMITED_PACK.price * 100) / 100, newUuid());
    }
    setPendingOrder(null);
    // Send the held question now that they've paid.
    const pending = paywallPendingRef.current;
    paywallPendingRef.current = null;
    if (pending) {
      void sendTextAfterPaywall(pending);
    }
  }

  function grantPack(questions: number, real = true, amountPaise?: number) {
    // Cumulative — repeat purchases add to the balance, never reset it.
    setPaidQuestions((prev) => {
      const next = prev + questions;
      localStorage.setItem(PAID_Q_KEY, String(next));
      return next;
    });
    if (real) {
      // Value = the actual order amount paid, not a hardcoded figure.
      trackPurchase((amountPaise ?? selectedPack.price * 100) / 100, newUuid());
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
    setRefined(false);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
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
    const question = pendingQuestion;
    const display = messages;
    setNeedDetails(false);
    setPendingQuestion("");
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
    const question = pendingMatch;
    const display = messages;
    setMatchCard(null);
    setMatchCardOpen(false);
    setPendingMatch("");
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
        <button
          className="chat-header__back"
          onClick={() => router.push("/")}
          aria-label={t("back")}
        >
          ‹
        </button>
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
        <span className="badge badge--ai">AI</span>
      </header>

      <div className="chat-body" ref={bodyRef}>
        <div className="welcome-chip">{t("welcome")}</div>

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

        {showStarters && (teaser || starters.length > 0) && (
          <div className="starter-chips">
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
        <button
          className="chat-send"
          onClick={send}
          disabled={!input.trim() || streaming}
          aria-label={t("send")}
        >
          <Send size={18} />
        </button>
      </div>

      {pendingOrder && (
        <div className="pending-banner">
          <span className="pending-banner__text">
            {t("pendingBanner")} (₹{pendingOrder.amountPaise / 100})
          </span>
          <button className="pending-banner__pay" onClick={resumePayment}>
            {t("pendingPay")}
          </button>
          <button
            className="pending-banner__close"
            onClick={() => setPendingOrder(null)}
            aria-label="Close"
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
              {(paidQuestions > 0 ? [...PACKS, UNLIMITED_PACK] : PACKS).map((p) => (
                <button
                  key={p.id}
                  className={`pack-option ${
                    selectedPack.id === p.id ? "pack-option--on" : ""
                  }`}
                  onClick={() => {
                    setSelectedPack(p);
                    trackPackSelected(p.price);
                  }}
                >
                  <span className="pack-option__price">₹{p.price}</span>
                  <span className="pack-option__q">
                    {p.unlimited ? t("packUnlimitedQ") : `${p.questions} ${t("packQ")}`}
                  </span>
                  {p.unlimited && (
                    <span className="badge badge--unlimited">{t("packUnlimitedBadge")}</span>
                  )}
                  {p.popular && <span className="badge badge--popular">Best value</span>}
                </button>
              ))}
            </div>

            <button className="btn btn--gold" onClick={buyPack}>
              {t("payBtn")} ₹{selectedPack.price}
            </button>
            <button
              className="gate-modal__ghost"
              onClick={() => {
                paywallPendingRef.current = null;
                setShowPaywall(false);
                trackPaywallDismissed();
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
