# Cron Scheduling (Supabase pg_cron → Hostinger-hosted Node routes)

**Status:** Domain fixed for 4 pre-existing jobs; 2 new jobs added for
previously-unscheduled routes; 1 route intentionally left unscheduled.
**Production domain confirmed:** `https://arprimemarket.shop`

## How this actually works

The app's own cron-pattern routes (`src/routes/api/public/cron/*.ts`,
`src/routes/api/public/seo/*.ts`) run **inside the Node app on Hostinger**
— they are not Supabase Edge Functions. Something external has to call
them on a schedule. That "something" is **Supabase's own `pg_cron` +
`pg_net` extensions** — a scheduled Postgres job that makes an outbound
HTTPS call to the Hostinger-hosted URL. This means:

- Supabase's database is the scheduler.
- The actual work happens on Hostinger (your Node process).
- No `cron-job.org` or third-party scheduler needed — Supabase already
  does this job for free, and it was already wired up (just pointed at
  the wrong domain — see below).

## Critical bug found and fixed: stale domain

Four `pg_cron` jobs were hardcoded to a Lovable preview domain
(`project--0e6af46a-....lovable.app`) instead of the real production site.
**This was a silent failure waiting to happen** — no error anywhere, the
features would just quietly stop running the moment the app moved off that
preview URL:

| Job                                 | What breaks if not fixed        | Fixed in                |
| ----------------------------------- | ------------------------------- | ----------------------- |
| `ai-seo-blog-daily-4am`             | Blog auto-generation stops      | `20260723090000_...sql` |
| `sync-dropship-stock-hourly`        | Product stock goes stale        | `20260723090000_...sql` |
| `agent-tick-every-minute`           | Scheduled agent tasks never run | `20260723090000_...sql` |
| `voice-agent-dispatch-every-minute` | Voice call dispatch stops       | `20260723090000_...sql` |

Two of these four (`ai-seo-blog-daily-4am`, `voice-agent-dispatch-every-minute`)
were also sending the Supabase **anon/publishable key** as their auth
header instead of a real cron secret — that would have failed the API
Gateway's `verifyCronRequest()` check (Module 2) regardless of the domain
being correct. Both were upgraded to the same dynamic
`integration_secrets(provider='cron')` lookup the other two jobs already
used correctly.

## Also found: two routes with zero scheduling at all

`api/public/seo/cron.ts` and `api/public/cron/zero-trust-scan.ts` both had
working `CRON_SECRET` auth checks but **no `pg_cron` job anywhere ever
called them** — dead code from a scheduling standpoint. Added in
`20260723090100_...sql`:

| Job                         | Schedule   | Notes                                       |
| --------------------------- | ---------- | ------------------------------------------- |
| `seo-auto-rescan-daily-5am` | Daily, 5am | Respects the `seo_auto_rescan` feature flag |
| `zero-trust-scan-daily-3am` | Daily, 3am | Security posture scan                       |

Times are staggered (3am, 4am, 5am) so the three daily jobs don't compete
for the single Hostinger Node process at the same moment — relevant given
the confirmed hosting constraint (one process, no horizontal scaling).

## Intentionally NOT scheduled: `seo/post-deploy`

This route's name and its optional `deploy_id` body parameter both signal
it's meant to run **once per deployment**, triggered by whatever deploys
the app — not on a timer. Scheduling it periodically would misrepresent
what "post-deploy" means and could run it redundantly alongside the daily
`seo-auto-rescan` job for no benefit.

**Action needed on your side:** wire a call to
`POST https://arprimemarket.shop/api/public/seo/post-deploy` (with the
`x-cron-secret` header) into whatever deploy step runs after
`scripts/hostinger-deploy.mjs` completes. If deployment is manual today,
this can wait — it's not urgent, just flagged so it isn't forgotten.

## Full job list (after both migrations)

```
0 3 * * *   zero-trust-scan-daily-3am
0 4 * * *   ai-seo-blog-daily-4am
0 5 * * *   seo-auto-rescan-daily-5am
0 * * * *   sync-dropship-stock-hourly
0 * * * *   fx-rates-sync-hourly
* * * * *   agent-tick-every-minute
* * * * *   voice-agent-dispatch-every-minute
```

## One thing to verify before deploying

Every job above depends on a row existing in `integration_secrets` with
`provider = 'cron'` and a real `api_key` value — if that row is missing,
every job silently no-ops (`RAISE LOG ... skipping`, returns `NULL`,
nothing crashes but nothing runs either). Confirm this row exists (via the
Supabase dashboard's table editor, or whatever admin settings page manages
`integration_secrets`) before relying on any of these jobs in production.
The same value should also be set as the app's `CRON_SECRET` env var on
Hostinger (or the two need to match, per `verifyCronRequest()`'s "either"
logic — see `src/lib/gateway/cronAuth.ts`).

## If the domain ever changes again

All six `net.http_post` URLs are inline string literals inside the
`SECURITY DEFINER` functions (`run_blog_generation_cron`,
`run_stock_sync_cron`, `run_seo_scan_cron`, `run_zero_trust_scan_cron`) or
directly in the `cron.schedule` body (`agent-tick-every-minute`,
`voice-agent-dispatch-every-minute`). There's no central config table for
this — a future improvement would be a settings table holding the
production URL, read via `SELECT` inside each function instead of being
hardcoded 6 times. Not built here since it would be scope creep on a
domain-fix module; flagging it as a real "would reduce future risk" item.
