"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useKundli } from "@/hooks/use-kundli";
import { getDeviceId, getOrCreateChatId, newUuid, saveKundli } from "@/lib/storage";
import { RASHI, NAKSHATRA, PLANET } from "@/lib/local-names";
import { pickStarters } from "@/lib/starters";
import {
  trackLead,
  trackInitiateCheckout,
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
import { AppNav } from "@/components/app-nav";
import { Send, Gem } from "lucide-react";

const OPENING_KEY = "jyotish_opening_v1";
const SIGNED_UP_KEY = "jyotish_signed_up_v1";
const PAID_Q_KEY = "jyotish_paid_questions_v1";
const FREE_LIMIT = 5; // 1 free + 2 login-gated + 2 more, then paywall

interface QuestionPack {
  id: string;
  price: number;
  questions: number;
  popular?: boolean;
}

/** Pack menu — ₹10 to ₹30, more value per rupee at higher tiers. */
const PACKS: QuestionPack[] = [
  { id: "p10", price: 10, questions: 10 },
  { id: "p20", price: 20, questions: 30, popular: true },
  { id: "p30", price: 30, questions: 50 },
];

/** Loads Razorpay checkout and opens the payment sheet. */
function openRazorpay(opts: {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const loadScript = () => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) return init();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = init;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    };
    const init = () => {
      const R = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void } }).Razorpay;
      if (!R) return resolve(false);
      const rzp = new R({
        key: opts.keyId,
        amount: opts.amount,
        currency: opts.currency,
        name: "Jyotish",
        description: "20 questions with Arya",
        order_id: opts.orderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const res = await fetch("/api/payment-verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
              body: JSON.stringify(response),
            });
            resolve(res.ok);
          } catch {
            resolve(false);
          }
        },
        modal: { ondismiss: () => resolve(false) },
      });
      rzp.open();
    };
    loadScript();
  });
}

/** Loads Google Identity Services and runs the sign-in prompt. */
function runGoogleIdentity(clientId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        const g = (window as unknown as {
          google?: { accounts?: { id?: { cancel: () => void } } };
        }).google;
        g?.accounts?.id?.cancel();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    const done = () => {
      const g = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (o: {
                client_id: string;
                callback: (r: { credential?: string }) => void;
              }) => void;
              prompt: () => void;
            };
          };
        };
      }).google;
      if (!g?.accounts?.id) return finish(false);
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => finish(!!resp?.credential),
      });
      g.accounts.id.prompt();
    };

    if (document.getElementById("gsi-client")) return done();
    const s = document.createElement("script");
    s.id = "gsi-client";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = done;
    document.head.appendChild(s);
  });
}

export function AryaChat({ initialQ }: { initialQ?: string }) {
  const t = useTranslations("Chat");
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
  const [selectedPack, setSelectedPack] = useState<QuestionPack>(PACKS[1]);
  const [askedCount, setAskedCount] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [experimentDone, setExperimentDone] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

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
    chart: KundliResult | null = kundli
  ) {
    const chatId = getOrCreateChatId();
    const messageId = newUuid();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getDeviceId(),
      },
      body: JSON.stringify({ kundli: chart, messages: apiMessages, lang: locale, chatId, messageId }),
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

    // Experiment tiers: Q1 free → Google login before Q2 → paywall after 5.
    if (!signedUp && askedCount >= 1) {
      setShowSignup(true);
      return;
    }
    const limit = FREE_LIMIT + paidQuestions;
    if (askedCount >= limit) {
      if (paidQuestions > 0) {
        setExperimentDone(true);
      } else {
        setShowPaywall(true);
      }
      return;
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setAskedCount((c) => c + 1);
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

  /** Google signup — real OAuth when a Client ID is configured, else simulated. */
  async function signUp() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId) {
      const ok = await runGoogleIdentity(clientId);
      if (!ok) return;
    }
    setSignedUp(true);
    localStorage.setItem(SIGNED_UP_KEY, "1");
    setShowSignup(false);
    trackSignup();
    try {
      await fetch("/api/signup", {
        method: "POST",
        headers: { "x-device-id": getDeviceId() },
      });
    } catch {
      // non-fatal
    }
  }

  /** Buy the selected pack — real Razorpay checkout when keys are set. */
  async function buyPack() {
    setShowPaywall(false);
    trackInitiateCheckout();
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "x-device-id": getDeviceId() },
        body: JSON.stringify({ amountPaise: selectedPack.price * 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Order failed");

      if (data.simulated) {
        grantPack(selectedPack.questions);
        return;
      }
      const ok = await openRazorpay(data);
      if (ok) grantPack(selectedPack.questions);
    } catch {
      setShowPaywall(true);
    }
  }

  function grantPack(questions: number) {
    setPaidQuestions(questions);
    localStorage.setItem(PAID_Q_KEY, String(questions));
    trackPurchase(selectedPack.price);
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

  async function open() {
    if (streaming) return;
    setStreaming(true);
    try {
      await streamReply([{ role: "user", content: t("opener") }], []);
      if (typeof window !== "undefined") localStorage.setItem(OPENING_KEY, "1");
    } catch {
      // ignore
    } finally {
      setStreaming(false);
    }
  }

  /** After the in-chat details form computes the chart: answer the pending question. */
  async function onDetailsComplete(newKundli: KundliResult) {
    saveKundli(newKundli);
    trackLead();
    const question = pendingQuestion;
    const display = messages;
    setNeedDetails(false);
    setPendingQuestion("");
    setAskedCount((c) => c + 1);
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

  // First message: if a question was carried from the landing, auto-send it.
  // Otherwise Arya speaks a personalised opener (once per device).
  useEffect(() => {
    if (!kundli) return;
    const timer = setTimeout(() => {
      if (initialQ && !initialSentRef.current) {
        initialSentRef.current = true;
        void sendText(initialQ);
        return;
      }
      if (!initialQ && messages.length === 0 && !localStorage.getItem(OPENING_KEY)) {
        void open();
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundli]);

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

  // Starter chips — context-aware, shown once the first reply has landed.
  const showStarters =
    !!kundli &&
    messages.length > 0 &&
    !streaming &&
    !experimentDone &&
    messages[messages.length - 1]?.role === "assistant";

  const starters = useMemo(() => {
    if (!showStarters) return [];
    const asked = new Set<string>();
    const context: string[] = [];
    for (const m of messages) {
      if (m.role === "user") {
        asked.add(m.content);
        context.push(m.content);
      } else {
        context.push(m.content);
      }
    }
    return pickStarters(context.join(" "), locale, asked);
  }, [messages, showStarters, locale]);

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

        {showStarters && starters.length > 0 && (
          <div className="starter-chips">
            {starters.map((q) => (
              <button key={q} className="chip" onClick={() => void sendText(q)}>
                {q}
              </button>
            ))}
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

      <AppNav inline />

      {showSignup && (
        <div className="gate-modal">
          <div className="gate-modal__card">
            <span className="gate-modal__g">G</span>
            <h2 className="gate-modal__title">{t("signupTitle")}</h2>
            <p className="gate-modal__sub">{t("signupSub")}</p>
            <button className="btn btn--gold" onClick={signUp}>
              {t("continueGoogle")}
            </button>
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

            <div className="pack-list">
              {PACKS.map((p) => (
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
                    {p.questions} {t("packQ")}
                  </span>
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
                setShowPaywall(false);
                trackPaywallDismissed();
              }}
            >
              {t("notNow")}
            </button>
          </div>
        </div>
      )}

      {experimentDone && (
        <div className="gate-modal">
          <div className="gate-modal__card">
            <h2 className="gate-modal__title">{t("doneTitle")}</h2>
            <p className="gate-modal__sub">{t("doneSub")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
