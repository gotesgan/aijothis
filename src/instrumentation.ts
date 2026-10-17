import type { Instrumentation } from "next";

/**
 * Server logs to PostHog (OpenTelemetry). Enabled by default in Next 16 — no
 * `experimental.instrumentationHook`.
 *
 * The OpenTelemetry SDK is Node-only, so both hooks guard on `NEXT_RUNTIME`
 * and import the implementation dynamically. A static import would pull
 * `node:crypto`-adjacent packages into the edge bundle that `proxy.ts`
 * middleware is built from, and the build would fail there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerPostHogLogs } = await import("@/lib/posthog-logs");
    registerPostHogLogs();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("@/lib/posthog-logs");
  await reportRequestError(err, request, context);
};
