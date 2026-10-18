/**
 * "Is there a page of ours behind this one?"
 *
 * `window.history.length` cannot answer that on its own: a brand-new tab
 * already reports 2, because the blank new-tab entry counts. Calling
 * `router.back()` from a cold-opened chat therefore walked onto `about:blank`.
 *
 * Recording the length once at app load turns the question into "have we
 * navigated since?", which is what the back buttons actually mean. The baseline
 * is captured by <Trackers>, mounted in the locale layout, so it is set on the
 * first client render of whatever page the visitor landed on — before any
 * client-side navigation can inflate the count.
 */
let baseline: number | null = null;

export function markHistoryBaseline() {
  if (typeof window === "undefined" || baseline !== null) return;
  baseline = window.history.length;
}

export function hasPreviousPage(): boolean {
  if (typeof window === "undefined" || baseline === null) return false;
  return window.history.length > baseline;
}
