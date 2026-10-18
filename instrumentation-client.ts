/*
 * Deliberately empty.
 *
 * This is Next's browser instrumentation hook, which runs before React
 * hydrates. It used to call `posthog.init()` here, unconditionally, as soon as
 * NEXT_PUBLIC_POSTHOG_KEY existed — so autocapture, pageviews and exception
 * tracking all began for every visitor, including those who had not consented
 * and those who had explicitly declined. Nothing in that path consulted the
 * consent store, and because posthog-js ignores a second `init()`, it also won
 * over the consent-gated initialiser and overrode its configuration.
 *
 * Initialisation now lives in exactly one place, `src/lib/posthog-client.ts`:
 * it imports the SDK on demand, only when the `analytics` choice is granted,
 * tells it to stop capturing when that choice is withdrawn, and carries the
 * client-side error capture that used to live here.
 *
 * Keep this file empty rather than deleting it, so a future PostHog setup step
 * has an obvious signpost instead of quietly re-adding a second initialiser.
 */
export {};
