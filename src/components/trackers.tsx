"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

import { hubspotBootstrap } from "@/lib/hubspot";
import { parseConsent, readConsentRaw, subscribeToConsent } from "@/lib/consent";
import { trackPageView } from "@/lib/pixel";
import { markHistoryBaseline } from "@/lib/nav-history";
import {
  startPostHogCapture,
  stopPostHogCapture,
  capturePostHogEvent,
  posthogConfigured,
} from "@/lib/posthog-client";

/**
 * Every third-party tracker on the site, mounted only where consent allows.
 *
 * Until a choice is made this renders nothing at all. That is the whole point:
 * a tracker that loads and is then "deleted" has already read the page and sent
 * the data, and nothing afterwards undoes that.
 *
 * Categories:
 *   marketing  — Meta Pixel (fbq)
 *   analytics  — Vercel Analytics, Microsoft Clarity, HubSpot, PostHog
 *
 * PostHog is loaded on demand (see `posthog-client.ts`) and is the one tracker
 * here that can be switched off again, which is what makes the footer's
 * "cookie settings" control a real withdrawal rather than a gesture.
 */
export function Trackers() {
  // Consent is read through useSyncExternalStore rather than effect + state.
  // The server snapshot is "not decided", so the first client render matches the
  // server HTML (no hydration mismatch) and a stored choice applies immediately
  // after. Deciding inside an effect would let the first server-rendered pass
  // act before the visitor had chosen.
  const raw = useSyncExternalStore(subscribeToConsent, readConsentRaw, () => null);
  const consent = parseConsent(raw);
  const pathname = usePathname();

  const marketing = consent?.marketing === true;
  const analytics = consent?.analytics === true;

  // Fires once consent is known, and again on each route change while it holds.
  // A side-effect, not setState, so this is fine in an effect. trackPageView is
  // null-safe, so it is a no-op when the pixel was never mounted.
  useEffect(() => {
    if (marketing) trackPageView();
  }, [pathname, marketing]);

  // PostHog: load it the moment analytics is granted, and tell it to stop the
  // moment that choice is withdrawn. `$pageview` is sent here rather than by the
  // SDK's own pageview capture, because this effect already knows about route
  // changes (the tab bar, the report links) and the SDK does not.
  useEffect(() => {
    if (!analytics) {
      stopPostHogCapture();
      return;
    }
    if (!posthogConfigured()) return;
    let cancelled = false;
    void startPostHogCapture().then(() => {
      if (!cancelled) capturePostHogEvent("$pageview");
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, analytics]);

  // Runs once, on whichever page the visitor landed on. Gives the back buttons a
  // "have we navigated since load?" signal that raw history.length cannot.
  useEffect(() => {
    markHistoryBaseline();
  }, []);

  if (!consent) return null;

  return (
    <>
      {marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1909120949758851');`}
        </Script>
      )}

      {analytics && (
        <>
          <Analytics />
          <Script id="clarity-snippet" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "xxn1pixdrd");`}
          </Script>
          <Script id="hs-tracker" strategy="afterInteractive">
            {hubspotBootstrap()}
          </Script>
        </>
      )}
    </>
  );
}