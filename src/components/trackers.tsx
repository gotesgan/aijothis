"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

import { hubspotBootstrap } from "@/lib/hubspot";
import { parseConsent, readConsentRaw, subscribeToConsent } from "@/lib/consent";
import { trackPageView } from "@/lib/pixel";

/**
 * Every third-party tracker on the site, mounted only where consent allows.
 *
 * Until a choice is made this renders nothing at all. That is the whole point:
 * a tracker that loads and is then "deleted" has already read the page and sent
 * the data, and nothing afterwards undoes that.
 *
 * Categories:
 *   marketing  — Meta Pixel (fbq)
 *   analytics  — Vercel Analytics, Microsoft Clarity, HubSpot
 *
 * PostHog is intentionally absent: the app calls `posthog.capture()` but never
 * `posthog.init()`, so nothing is currently sent today. If that is fixed later,
 * gate it here behind `analytics`.
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