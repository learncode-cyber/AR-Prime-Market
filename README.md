# AR Prime Market

International dropshipping e-commerce platform (USA, Canada, UK, Australia,
Germany, France, Italy, Spain, Netherlands, UAE) built on TanStack Start
(React 19, SSR via Nitro) with Supabase (Postgres, Auth, Storage, Edge
Functions) as the backend, plus a built-in autonomous marketing/ops agent
network ("CHRO orchestrator" + 4 sub-agents) and an AI shopping assistant.

## Stack

- **Frontend:** React 19, TanStack Router (file-based, `src/routes/`),
  TanStack Start SSR, Tailwind v4, Radix UI / shadcn components, PWA.
- **Backend:** Supabase — Postgres with RLS, Auth, Storage, 25+ Edge
  Functions (Deno) under `supabase/functions/`.
- **AI:** Google Gemini via `src/lib/gemini.server.ts`, wrapped as a plugin
  in `src/lib/plugins/` (see `docs/architecture/PLUGIN_SYSTEM.md`).
- **Deploy targets:** Node/Nitro SSR, or a static shell for Hostinger
  shared hosting (`scripts/hostinger-*.mjs`, `hostinger-server.js`).

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project's URL + publishable key
npm run dev
```

## Common scripts

| Command                    | What it does                                     |
| -------------------------- | ------------------------------------------------ |
| `npm run dev`              | Local dev server                                 |
| `npm run test`             | Run the vitest suite                             |
| `npm run test:watch`       | Watch mode                                       |
| `npm run lint`             | ESLint                                           |
| `npm run format`           | Prettier — fixes formatting repo-wide            |
| `npx tsc --noEmit`         | Typecheck                                        |
| `npm run build:node`       | Production build, Node/SSR target                |
| `npm run build:hostinger`  | Production build, Hostinger static-shell target  |
| `npm run deploy:hostinger` | Deploy to Hostinger via FTP (see `docs/devops/`) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, and both build
targets on every PR to `main` — see `docs/devops/CI.md`.

## Repository layout

```
src/
  routes/            File-based routes (TanStack Router). kali_master.*
                      files are the admin console (~150 routes).
  routes/api/         Raw API route handlers (server.handlers pattern)
  lib/                Shared server/client logic
    gateway/           API Gateway — see docs/architecture/API_GATEWAY.md
    plugins/            Plugin system — see docs/architecture/PLUGIN_SYSTEM.md
    ai-memory/           Shared AI memory client — see docs/architecture/SHARED_AI_MEMORY.md
    monitoring/           Error reporting — see docs/architecture/MONITORING.md
    arq-os.functions.ts    ARQ Master OS proposal control plane
  context/            React contexts (Auth, Cart, Currency, Language, ...)
  test/security/      Security regression tests (XSS, edge-function auth)
supabase/
  functions/          Edge Functions (Deno) — payments, suppliers, AI agents, cron
  migrations/          101+ SQL migrations (see caveat below)
docs/
  architecture/        Module design docs (one per major subsystem)
  devops/               CI, environment variables, security notes
```

## Important known issue: migration history is incomplete

`supabase/migrations/` does **not** contain a baseline schema — the
earliest migration already `ALTER TABLE`s `products`, meaning most core
tables (`products`, `user_roles`, `app_role`, etc.) were created outside
this migrations folder, almost certainly via direct dashboard changes
before migration tracking started. **A fresh Supabase project cannot be
built from these migrations alone.** See
`docs/architecture/GLOBAL_AUTH_RBAC.md` ("Important finding first") for
detail and the recommended fix (`supabase db dump` against the live
project, committed as migration 0).

## Architecture docs

Each major subsystem added since the initial Lovable-generated codebase has
a design doc under `docs/architecture/`:

- **`ARQ_MASTER_OS_INTEGRATION_PLAN.md`** — the overall plan tying
  everything below together.
- **`API_GATEWAY.md`** — auth/rate-limit/error-handling wrapper for API routes.
- **`GLOBAL_AUTH_RBAC.md`** — role-based access control (admin/moderator/user).
- **`SHARED_AI_MEMORY.md`** — cross-agent shared context (chat, shopping
  assistant, blog generator all read the same vetted facts).
- **`PLUGIN_SYSTEM.md`** — pluggable AI provider registry (suppliers/
  payments are contracts-only pending a dedicated migration module).
- **`ARQ_MASTER_OS_CORE.md`** — the sub-agent proposal approval queue.
- **`MONITORING.md`** — error reporting + health check.

DevOps docs are under `docs/devops/`:

- **`CI.md`** — what the pipeline checks and why.
- **`ENVIRONMENT.md`** — every env var / secret, where it's used, sensitivity.
- **`MODULE_1B_SECURITY_HOTFIX.md`** — a security audit + fix log worth
  reading once, for the specific classes of bugs it caught.

## Hosting constraints (read before proposing new infrastructure)

Production target is a **Hostinger Business Plan**: single Node.js
process, no Docker, no Redis/BullMQ. Anything requiring a sidecar
container or a message queue needs a different hosting plan first — design
around plain HTTPS calls from one process (see `MONITORING.md` for how the
error-reporting module handled this).

## Known, deliberately-flagged-not-fixed items

A few things were found during the modules above and intentionally left
for a product/business decision rather than silently changed:

1. **BDT vs USD**: `src/routes/api/chat.ts`'s system prompt describes the
   store as Bangladeshi/BDT, while the CHRO agent's own shared learnings
   (and the Marketing sub-agent's system prompt) say USD-only, no BDT
   mentions in public copy. See `SHARED_AI_MEMORY.md` and
   `ARQ_MASTER_OS_CORE.md` for the two independent findings.
2. **Migration baseline gap** — see above.
3. **~8,500 pre-existing Prettier formatting violations** — real, but a
   `npm run format` away from fixed; deliberately not run as a side effect
   of any other module, since it would touch nearly every file in one diff.
