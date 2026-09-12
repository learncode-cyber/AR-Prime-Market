# Environment Variables Reference

**Module:** Phase 0 — DevOps & Security Guardrails
**Status:** Production ready

## Rule (Zero Trust baseline)

`.env` and every `.env.*` file (except checked-in `*.example` templates) are
git-ignored (see `.gitignore`). **Never commit a real secret.** If a secret is
ever committed, it must be treated as compromised and rotated immediately in
Supabase / the relevant provider dashboard — deleting it from git history is
not sufficient once it has been pushed.

## Local app env (`.env`, template at `.env.example`)

| Variable                        | Scope            | Sensitivity | Notes                                                                    |
| ------------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------ |
| `SUPABASE_URL`                  | server           | low         | Project URL, safe to expose                                              |
| `SUPABASE_PROJECT_ID`           | server           | low         | Project ref                                                              |
| `SUPABASE_PUBLISHABLE_KEY`      | server           | low         | Anon/publishable key — protected by RLS, not a secret                    |
| `VITE_SUPABASE_URL`             | client (bundled) | low         | Same as above, exposed to browser                                        |
| `VITE_SUPABASE_PROJECT_ID`      | client (bundled) | low         | Same as above                                                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client (bundled) | low         | Same as above — **never** put a service-role key behind a `VITE_` prefix |

## Supabase Edge Function secrets (set via `supabase secrets set`, NOT in `.env`)

These are consumed by the 25 functions in `supabase/functions/*` and must
**never** appear in any file under `src/` or in any `VITE_`-prefixed variable,
since those are bundled into public client JS.

| Secret                                       | Used by                                                      | Sensitivity  |
| -------------------------------------------- | ------------------------------------------------------------ | ------------ |
| `SUPABASE_SERVICE_ROLE_KEY`                  | ~20 functions needing elevated DB access                     | **critical** |
| Payment provider keys (bKash, Binance Pay)   | `bkash-pay`, `binance-pay-gateway`                           | **critical** |
| `META_CAPI_ACCESS_TOKEN` / Meta Pixel secret | `meta-capi`, `meta-insights`                                 | high         |
| AI provider keys (Gemini, etc.)              | `chro-orchestrator`, `ai-learning-engine`, blog/marketing AI | high         |
| `TELEGRAM_BOT_TOKEN`                         | `telegram-notify`, `telegram-webhook`                        | high         |
| Supplier API keys (CJ Dropshipping)          | `cj-proxy`, `cj-webhook`, `supplier-sync`                    | high         |
| Email provider credentials                   | `send-email`                                                 | high         |

A full secret inventory audit (confirming each of the above is actually set
via Supabase secrets and not hardcoded anywhere) is scheduled as part of the
**Security module**, not this DevOps module — flagging here so it isn't lost.

## Hostinger deploy env

See `.env.hostinger.example` (pre-existing, unchanged by this module) for the
FTP/deploy-specific variables used by `scripts/hostinger-deploy.mjs`.

## CI env

CI uses placeholder values only — see `docs/devops/CI.md`.
