/**
 * Monitoring & Error Tracking (Module 7).
 *
 * Deployment context this was designed for (per the project's actual
 * hosting constraints): Hostinger Business Plan, single Node.js process,
 * no Docker, no Redis. That rules out any monitoring approach that assumes
 * a sidecar container or a message queue. What it doesn't rule out: SaaS
 * error trackers (Sentry, Better Stack, etc.) — those just need an HTTPS
 * call, which works fine from a single Node process.
 *
 * This module ships a small, dependency-free reporter abstraction with:
 *  - a console sink (always active — this alone is strictly better than
 *    the status quo, which was zero structured error visibility anywhere)
 *  - an optional generic webhook sink (works with the project's own
 *    telegram-notify function today; also compatible with Slack/Discord
 *    incoming webhooks, or any other HTTPS endpoint, if one is configured
 *    later)
 *
 * It deliberately does NOT add the @sentry/node SDK. That SDK does global
 * auto-instrumentation (patches http, unhandled rejection handlers, etc.)
 * — wiring that in blind, with no real DSN to verify against, risks
 * subtly changing behavior across the whole app for a "monitoring" module
 * that's supposed to be low-risk. If real Sentry is wanted, adding the SDK
 * is a small, focused follow-up once a DSN exists to actually test against
 * — see docs/architecture/MONITORING.md.
 */

export interface ErrorContext {
  /** Where this error happened — e.g. "gateway:chat", "cron:sync-stock". */
  source: string;
  /** Correlates with the gateway's per-request requestId, when available. */
  requestId?: string;
  /** Any additional structured context — kept small and non-sensitive. */
  extra?: Record<string, unknown>;
}

export interface ErrorReporter {
  reportError(error: unknown, context: ErrorContext): void | Promise<void>;
}

/**
 * Always-on sink: structured console.error. Cheap, synchronous, cannot fail
 * in a way that breaks the caller.
 */
export const consoleReporter: ErrorReporter = {
  reportError(error, context) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      JSON.stringify({
        level: "error",
        source: context.source,
        requestId: context.requestId,
        message,
        extra: context.extra,
        timestamp: new Date().toISOString(),
      }),
    );
    if (stack) console.error(stack);
  },
};

/**
 * Optional sink: POSTs to a configured webhook URL. Never throws — a
 * broken webhook must never take down the feature that triggered the
 * error report in the first place.
 *
 * Payload shape defaults to `{ text }`, which the project's existing
 * `telegram-notify` edge function already accepts for ad-hoc messages
 * (see supabase/functions/telegram-notify/index.ts) — so setting
 * MONITORING_WEBHOOK_URL to that function's URL works out of the box with
 * zero new infrastructure. A Slack/Discord incoming webhook also accepts
 * `{text}`-shaped bodies for a simple message, so this isn't Telegram-specific.
 */
export function createWebhookReporter(webhookUrl: string): ErrorReporter {
  return {
    async reportError(error, context) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 [${context.source}] ${message}${context.requestId ? ` (req: ${context.requestId})` : ""}`,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Never let a monitoring failure become a user-facing failure.
      }
    },
  };
}

/**
 * The active set of reporters. Console is always included. A webhook
 * reporter is added automatically if MONITORING_WEBHOOK_URL is set —
 * no code changes needed to turn this on, just the env var.
 */
function buildReporters(): ErrorReporter[] {
  const reporters: ErrorReporter[] = [consoleReporter];
  const webhookUrl = process.env.MONITORING_WEBHOOK_URL;
  if (webhookUrl) reporters.push(createWebhookReporter(webhookUrl));
  return reporters;
}

let reporters: ErrorReporter[] | null = null;

/**
 * Reports an error to every active sink. Fire-and-forget on the webhook
 * sink (does not await it) so a slow/broken monitoring endpoint never adds
 * latency to the request that failed — the console sink runs synchronously
 * first so the error is never silently lost even if the process crashes
 * immediately after.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  if (!reporters) reporters = buildReporters();
  for (const reporter of reporters) {
    const result = reporter.reportError(error, context);
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => {
        /* reporters must never throw into the caller */
      });
    }
  }
}

/** Test-only: forces reporters to be rebuilt from current env on next call. */
export function _resetReportersForTests(): void {
  reporters = null;
}
