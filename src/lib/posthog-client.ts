"use client";

import type { PostHog } from "posthog-js";

/**
 * Lazily initialises PostHog, and keeps it honest about consent.
 *
 * Two rules, both inherited from `consent.ts`:
 *
 *  1. NOTHING LOADS BEFORE A CHOICE. The SDK is imported dynamically, so a
 *     visitor who has not answered — or who declined — never downloads it. The
 *     other trackers in `trackers.tsx` work the same way: a script that loads
 *     and is then "deleted" has already read the page.
 *  2. WITHDRAWAL HAS TO WORK. `trackers.tsx` can unmount a <Script>, but a
 *     library already running in the page cannot be unloaded — it has to be
 *     told to stop. `opt_out_capturing()` does that, and the footer's cookie
 *     control is the thing that must trigger it, exactly as the footer comment
 *     in this repo says: withdrawal has to be as easy as granting.
 *
 * Autocapture and session recording are off on purpose: this app records
 * deliberate events by name (see the `capturePostHog` call sites), pageviews
 * are captured from the existing route-change effect, and Clarity already owns
 * session replay. Nothing here duplicates another tool.
 */
let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

export function posthogConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
  );
}

/** Loads and initialises once. Returns null when unconfigured or unreachable. */
export function loadPostHog(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (!posthogConfigured()) return Promise.resolve(null);
  if (loading) return loading;

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
        // Pageviews come from the route-change effect that already exists for
        // the Meta pixel, so the SDK does not need to watch history itself.
        capture_pageview: false,
        // Named events only — autocapture would send a stream we never read.
        autocapture: false,
        // Anonymous visitors stay anonymous; a person profile is only created
        // once someone is identified (Google sign-in).
        person_profiles: "identified_only",
        // Clarity owns replay. Two replay tools is double the privacy surface
        // for the same information.
        disable_session_recording: true,
        respect_dnt: true,
      });
      client = posthog;
      return posthog;
    })
    .catch(() => null);

  return loading;
}

/** Called when the analytics choice is granted (and on later route changes). */
export async function startPostHogCapture(): Promise<void> {
  const posthog = await loadPostHog();
  posthog?.opt_in_capturing();
}

/** Called the moment analytics is withdrawn. */
export function stopPostHogCapture(): void {
  client?.opt_out_capturing();
}

/** A named event, no-op until PostHog has actually loaded. */
export function capturePostHogEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  client?.capture(event, properties);
}
