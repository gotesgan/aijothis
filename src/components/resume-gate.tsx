"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { getDeviceId, KUNDLI_KEY, loadKundli, saveKundli } from "@/lib/storage";
import type { KundliResult } from "@/lib/types";

type Mode = "redirect" | "hydrate";

/**
 * Resume handling for a returning user.
 *
 * `useKundli()` reads localStorage through `useSyncExternalStore`, whose
 * subscription only fires on CROSS-TAB `storage` events — so writing the chart
 * back with `saveKundli()` alone would leave every mounted consumer showing
 * nothing. Dispatching a synthetic `storage` event re-runs the existing
 * subscription, which rehydrates the chart with no page reload and no second
 * source of truth.
 */
function rehydrate(kundli: KundliResult) {
  saveKundli(kundli);
  window.dispatchEvent(new StorageEvent("storage", { key: KUNDLI_KEY }));
}

/**
 * mode="redirect" — send a returning user straight to their chat.
 *   Mounted on the landing page. If the server already holds a chart for this
 *   person, the birth-details form is something they have demonstrably already
 *   completed, so re-asking it is pure friction.
 *
 * mode="hydrate" — restore the chart (and signed-up status) for someone who
 *   landed on /chat without one: a new phone, cleared site data, or a
 *   different browser. No navigation, so it is safe anywhere.
 *
 * Both share one `/api/me` round trip. Fails soft: any error simply leaves the
 * user on the page they were already on, which is the same thing that happens
 * today.
 */
export function ResumeGate({ mode }: { mode: Mode }) {
  // next-intl's router, NOT next/navigation's: with `localePrefix: "always"`
  // a plain `replace("/chat")` would navigate to the site root and drop the
  // locale, bouncing a हिंदी/मराठी user out of their language on the very first
  // thing this feature does.
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Already on this device — go straight to the chat, no round trip.
      // (Checked before the fetch, not used as a reason to skip the redirect.)
      if (mode === "redirect" && loadKundli()) {
        router.replace("/chat");
        return;
      }

      try {
        const res = await fetch("/api/me", {
          headers: { "x-device-id": getDeviceId() },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data?.hasKundli || !data.kundli) return;

        if (!loadKundli()) rehydrate(data.kundli as KundliResult);

        if (mode === "redirect") {
          // The session gate is derived from localStorage too; mirror the
          // server's answer so a signed-up user is not re-gated on a new
          // device. (arya-chat does the same on mount.)
          if (data.signedUp) {
            localStorage.setItem("jyotish_signed_up_v1", "1");
          }
          router.replace("/chat");
        }
      } catch {
        // Offline / endpoint unreachable — fall through silently.
      }
    }

    // Deferred one tick so a deliberate tap wins the race. Clicking a question
    // chip on the landing page unmounts this component, and the cleanup cancels
    // the redirect — so the user's own navigation is never overridden by ours.
    const timer = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, router]);

  return null;
}