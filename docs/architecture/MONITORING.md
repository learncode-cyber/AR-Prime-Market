# Monitoring & Error Tracking (Module 7)

**Status:** Complete for the scope described below.
**Hosting constraint honored:** Hostinger Business Plan, single Node.js
process, no Docker, no Redis (confirmed by the project owner). Everything
in this module runs as plain HTTPS calls from that one process — no sidecar,
no queue, no new infrastructure required.

## What was missing before

The original audit found **zero** structured error monitoring anywhere —
no Sentry, no Datadog, no equivalent. Errors either went to an unstructured
`console.error(...)` (in the few places that logged at all) or were
silently swallowed. There was also no health-check endpoint for external
uptime monitoring.

## What was built

### `src/lib/monitoring/index.ts` — error reporter

- **`consoleReporter`** (always active) — structured JSON log lines
  (`source`, `requestId`, `message`, `extra`, `timestamp`) instead of
  unstructured `console.error(...)`. This alone is a real improvement:
  logs are now grep/parse-able instead of free text.
- **`createWebhookReporter(url)`** (opt-in via `MONITORING_WEBHOOK_URL` env
  var) — POSTs a `{text}` payload to any HTTPS endpoint. Deliberately
  generic: works with the project's own `telegram-notify` edge function
  (already deployed, accepts ad-hoc `{text}` messages) with zero new
  infrastructure, and is also compatible with Slack/Discord incoming
  webhooks or any future SaaS error tracker's webhook ingestion.
- **`reportError(error, context)`** — the call site API. Console sink runs
  synchronously (never lost even if the process crashes right after);
  webhook sink is fire-and-forget so a slow/broken monitoring endpoint
  never adds latency to the request that failed, and never throws into the
  caller.

### Wired into the API Gateway

`withGateway`'s existing catch-all error handler (which was already there
from Module 2, previously a bare `console.error`) now calls `reportError`
instead — every unhandled error in every gateway-wrapped route
automatically gets structured logging + optional webhook alert, with zero
per-route changes needed.

### `GET /api/public/health`

New endpoint for external uptime monitors (UptimeRobot, Better Stack,
Pingdom — all poll over plain HTTPS, which fits the no-Docker constraint
exactly). Returns `200 {status:"ok", db:"ok", latencyMs}` when both the
process and the Supabase connection are healthy, `503 {status:"degraded",
db:"error"}` if the DB check fails — so an uptime monitor catches "app is
up but database is unreachable," not just "process crashed."

## Why @sentry/node was NOT added

Sentry's Node SDK does global auto-instrumentation on init — patches
`http`, registers `unhandledRejection`/`uncaughtException` handlers, etc.
Wiring that into the whole app with no real Sentry DSN to verify the
behavior against (this sandbox has no way to check what actually gets
captured/sent) is a bigger, less certain change than this module's scope
justifies. If real Sentry is wanted: get a DSN, and adding the SDK becomes
a small, verifiable follow-up — set `SENTRY_DSN`, install the package, done.
Until then, the console + webhook reporters are honest, working,
zero-new-dependency monitoring rather than a half-verified SDK integration.

## Setup (when you're ready to turn on alerts)

No code changes needed — just set an env var:

```
MONITORING_WEBHOOK_URL=https://<your-project>.supabase.co/functions/v1/telegram-notify
```

## Testing performed

- 11 new unit tests: structured console output shape, non-Error values
  handled safely, webhook payload shape and content, webhook failures
  never throwing, the aggregate `reportError` always hitting console and
  conditionally hitting the webhook based on env var, and never throwing
  synchronously regardless of configuration.
- `npx tsc --noEmit` → **0 errors** (including the new health-check route,
  after regenerating `routeTree.gen.ts`).
- `npm run test` → **115/115 passed**, 16/16 files.
- `npx eslint --fix` scoped to touched files — 0 errors.

## Next step

Waiting on:

1. Whether to set `MONITORING_WEBHOOK_URL` now (reusing `telegram-notify`)
   or wait for a dedicated error-tracking SaaS decision.
2. Move to the next roadmap item.
