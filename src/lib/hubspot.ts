/**
 * HubSpot tracking code.
 *
 * The vendor snippet is installed inline by `[locale]/layout.tsx`, because
 * `next/script`'s `onError` did not reliably fire when the script was blocked
 * (tested: ad-blocking `*.hs-scripts.com` produced no handler call at all, so
 * a blocked tracker would have been invisible). An explicit `onerror` on the
 * element we create ourselves is the dependable signal.
 *
 * This module owns the two things worth centralising:
 *  - the portal ID / src, so there is one place to change them;
 *  - `trackHubSpotEvent`, so call sites never touch `window._hsq` and never
 *    throw when the tracker is blocked.
 *
 * Everything here fails soft. Third-party analytics is routinely blocked by
 * ad blockers, it is not on the critical path, and a blocked tracker must
 * never surface an error to a visitor or interrupt a checkout.
 */

/** HubSpot portal ID from the embed snippet. */
export const HUBSPOT_PORTAL_ID = "247685246";

/**
 * Explicit protocol. The vendor snippet uses a protocol-relative
 * `//js-na2.hs-scripts.com/...`, which is a mixed-content hazard and can
 * resolve to http:// on some edge paths.
 */
export const HUBSPOT_SRC = `https://js-na2.hs-scripts.com/${HUBSPOT_PORTAL_ID}.js`;

interface HubSpotWindow extends Window {
  _hsq?: unknown[];
  /** Set when the loader failed, so app code can branch without a console read. */
  __hubspotLoadFailed?: boolean;
}

/**
 * The bootstrap snippet, emitted verbatim into the page.
 *
 * Structure mirrors the vendor's own: create the script element, mark it async
 * and deferred, insert it ahead of the first existing script tag. The
 * `window._hsq` stub is declared FIRST so anything pushed before the tracker
 * arrives is queued and replayed rather than lost — that queue is what
 * preserves the landing pageview on a slow connection.
 *
 * Pure and side-effect free at module scope so it is safe to import from a
 * Server Component.
 */
export function hubspotBootstrap(): string {
  return `(function(w,d){
if(!w._hsq)w._hsq=[];
var s=d.createElement('script');
s.id='hs-script-loader';s.async=1;s.defer=1;
s.src=${JSON.stringify(HUBSPOT_SRC)};
s.onerror=function(){w.__hubspotLoadFailed=true;w.console.warn(
"[hubspot] tracking code failed to load (portal ${HUBSPOT_PORTAL_ID}). This visit will be missing from HubSpot analytics. Usual causes: an ad or content blocker on *.hs-scripts.com, or a blocked network. Nothing on the site is affected."
);};
var f=d.getElementsByTagName('script')[0];
if(f&&f.parentNode)f.parentNode.insertBefore(s,f);else(d.head||d.body).appendChild(s);
})(window,document);`;
}

function getQueue(): HubSpotWindow["_hsq"] {
  if (typeof window === "undefined") return undefined;
  const w = window as HubSpotWindow;
  // Not initialised means either the bootstrap stub hasn't run yet or the
  // tracker was blocked. Either way, degrade rather than throw.
  return Array.isArray(w._hsq) ? w._hsq : undefined;
}

/**
 * Sends a custom behavioural event.
 *
 * `name` must be the internal event name from your HubSpot custom behavioural
 * event definition (format `pe<portalId>_my_event`). HubSpot silently drops
 * events it doesn't recognise, so a typo is invisible rather than an error —
 * verify new event names in HubSpot before relying on them.
 *
 * Returns false instead of throwing when the tracker isn't available.
 */
export function trackHubSpotEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): boolean {
  const queue = getQueue();
  if (!queue) {
    console.warn(
      "[hubspot] tracker unavailable (still loading, or blocked). Event dropped:",
      name
    );
    return false;
  }
  queue.push(["trackCustomBehavioralEvent", { name, properties }]);
  return true;
}

/** True when the queue exists, so events can be accepted. */
export function hubspotReady(): boolean {
  return typeof window !== "undefined" && Array.isArray((window as HubSpotWindow)._hsq);
}

/**
 * True when the tracker script was blocked and never loaded. Lets app code
 * (and tests) distinguish "blocked" from "still loading" without scraping
 * console output.
 */
export function hubspotLoadFailed(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as HubSpotWindow).__hubspotLoadFailed === true
  );
}