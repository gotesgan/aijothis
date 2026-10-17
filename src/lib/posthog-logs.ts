import "server-only";

import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";

import { CONSENT_COOKIE, consentFromCookie } from "@/lib/consent";

/**
 * Server logs to PostHog, over OpenTelemetry.
 *
 * Two rules shape this, both inherited from `consent.ts`:
 *
 *  1. DENIED IS THE DEFAULT. A log line about a visitor is a send to a third
 *     party, exactly like a Meta or Clarity event, so it is gated behind the
 *     same `analytics` choice — read from the mirrored consent cookie, which is
 *     what makes server-side gating possible at all. A visitor who declined is
 *     never reported.
 *  2. NOTHING IS SENT THAT WAS NOT ASKED FOR. Next does not forward console.*
 *     to OpenTelemetry, so the only lines that leave are the ones emitted here
 *     by name. That is why the call sites stay few and deliberate.
 *
 * The provider is built once, lazily, and exported so route handlers can flush
 * it: a serverless function can freeze the moment the response is written, and
 * a batched log that never flushes is a log that never arrives.
 */

const SERVICE_NAME = "jyotish-web";

function logsEndpoint(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  return `${host.replace(/\/+$/, "")}/i/v1/logs`;
}

let provider: LoggerProvider | null = null;
let built = false;

/**
 * The process-wide provider, or null when PostHog is not configured. Built at
 * most once so `register()` and the route handlers share one exporter.
 */
export function getLoggerProvider(): LoggerProvider | null {
  if (built) return provider;
  built = true;

  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token) return null;

  provider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": SERVICE_NAME }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: logsEndpoint(),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ],
  });

  return provider;
}

/** Called once per server instance from `instrumentation.ts`. */
export function registerPostHogLogs(): void {
  const active = getLoggerProvider();
  if (active) logs.setGlobalLoggerProvider(active);
}

/**
 * Consent, read from a Cookie header.
 *
 * Used by `onRequestError`, which is handed request headers rather than a
 * cookie jar. `consentFromCookie` does the parsing and rejects anything stale
 * or malformed, so an unsigned cookie cannot opt a visitor in.
 */
function consentAllows(cookieHeader: string | string[] | undefined): boolean {
  if (!cookieHeader) return false;
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  const entry = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!entry) return false;
  return consentFromCookie(entry.slice(CONSENT_COOKIE.length + 1))?.analytics === true;
}

function emit(
  active: LoggerProvider,
  body: string,
  attributes: Record<string, string | number | boolean>,
  severityNumber: SeverityNumber
): void {
  active.getLogger(SERVICE_NAME).emit({ body, severityNumber, attributes });
}

/**
 * Log one server line, if the visitor agreed to analytics.
 *
 * Request-scoped: it reads the consent cookie and schedules the flush with
 * `after()`, both of which need an active request. Outside one it is a no-op
 * rather than an error — a log line is never worth failing a response over.
 */
export async function logServer(
  body: string,
  attributes: Record<string, string | number | boolean> = {},
  severityNumber: SeverityNumber = SeverityNumber.INFO
): Promise<void> {
  const active = getLoggerProvider();
  if (!active) return;

  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    if (consentFromCookie(jar.get(CONSENT_COOKIE)?.value)?.analytics !== true) return;
  } catch {
    return;
  }

  emit(active, body, attributes, severityNumber);

  try {
    const { after } = await import("next/server");
    after(async () => {
      await active.forceFlush().catch(() => {});
    });
  } catch {
    await active.forceFlush().catch(() => {});
  }
}

/**
 * Report an unhandled server error. Wired to `onRequestError`.
 *
 * Deliberately narrow: route identity, method, and the error itself. Request
 * headers are never sent — they carry cookies — and no visitor input is
 * attached, so the message is the only field that could ever quote a user, and
 * that only when the thrown error chose to.
 */
export async function reportRequestError(
  err: unknown,
  request: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: { routerKind: string; routePath: string; routeType: string }
): Promise<void> {
  const active = getLoggerProvider();
  if (!active) return;
  if (!consentAllows(request.headers.cookie ?? request.headers["Cookie"])) return;

  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : "";

  emit(
    active,
    `Unhandled server error: ${request.method} ${request.path}`,
    {
      http_method: request.method,
      route_path: context.routePath,
      router_kind: context.routerKind,
      route_type: context.routeType,
      error_message: message,
      error_digest: digest,
    },
    SeverityNumber.ERROR
  );

  // Awaited, not `after()`: onRequestError is already off the response path.
  await active.forceFlush().catch(() => {});
}
