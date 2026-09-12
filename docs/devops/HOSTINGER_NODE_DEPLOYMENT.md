# Hostinger Deployment: Mode B (Full Node/Nitro Server) — Chosen

**Decision made:** deploy the full TanStack Start / Nitro server (Mode B),
not the static SPA shell (Mode A), because every server-side feature built
in Modules 2-9 — the API Gateway, `/api/public/cron/*`, `/api/public/seo/*`,
the ARQ Master OS admin control plane (`createServerFn`s), the health
check, and both `/api/chat.ts` and `/api/shopping-agent.ts` — **only exist
in Mode B.** Mode A's `hostinger-server.js` is, by its own header comment,
"pure static" and explicitly does not handle any of these.

Hostinger Business Plan supports this: it offers a genuine "Node.js App"
hosting feature (GitHub deploy or zip upload, per the plan comparison you
shared), not just static file hosting — no VPS needed for this.

## The two modes, so this doesn't get confused later

|                                     | Mode A (static shell)                                        | Mode B (full server) — chosen                  |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Build command                       | `npm run build:hostinger`                                    | `npm run build:node`                           |
| Entry point                         | `hostinger-server.js` (plain Express, static + SPA fallback) | `start-server.mjs` (wraps Nitro node-server, adds /healthz + static caching) |
| Package script                      | `npm run package:hostinger` (pre-existing)                   | `npm run package:hostinger-node` (new)         |
| `/api/*` routes work?               | No                                                           | Yes                                            |
| Cron endpoints reachable?           | No                                                           | Yes                                            |
| ARQ Master OS admin functions work? | No                                                           | Yes                                            |
| When you'd actually want this       | Storefront-only static hosting, no backend features needed   | Everything built in Modules 2-9                |

Both scripts are kept — Mode A isn't deleted, just not the recommended
path anymore given what's been built. If a lightweight static-only
deployment is ever needed again (e.g. a maintenance page), Mode A still
works exactly as before.

## Setup steps (hPanel)

1. Build + package: `npm run package:hostinger-node` — produces
   `dist-hostinger/arprimemarket-hostinger-node-<timestamp>.zip`.
2. Upload that zip via hPanel's Node.js App zip-upload option (or push to
   the GitHub repo hPanel is watching, if using GitHub-deploy instead of
   zip upload).
3. In hPanel -> Node.js:
   - Application Entry File: `start-server.mjs`
   - Startup command: `npm start` (points to
     `node start-server.mjs` inside the packaged app's own
     package.json — the source repo's `npm run start`, for Mode A, is untouched)
   - Node version: 20.x or newer
4. Set environment variables (hPanel -> Node.js -> Environment variables).
   At minimum, per `docs/devops/ENVIRONMENT.md`:
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `CRON_SECRET` — must match the `integration_secrets(provider='cron')`
     row used by the pg_cron jobs (see `docs/devops/CRON_SCHEDULING.md`)
   - `MONITORING_WEBHOOK_URL` (optional, Module 7)
5. Run `npm install` from the hPanel Node.js interface (or via SSH —
   hPanel -> Advanced -> SSH Access).
6. Start/restart the app.

## Verify the deployment actually worked

```
GET https://arprimemarket.shop/api/public/health
```

Should return `200 {"status":"ok","db":"ok","latencyMs":...}`. If this
404s or returns the SPA's index.html instead of JSON, the Node.js App is
NOT running the Nitro server — double check the Application Entry File
path in hPanel matches `start-server.mjs` exactly. Nitro's
node-server preset output filename could in principle change between
framework versions; `scripts/hostinger-package-node.mjs` fails loudly at
build time if that path doesn't exist rather than silently packaging the
wrong thing, so trust that script's error message over this doc if they
ever disagree.

## Dependency size note

Unlike Mode A's script (which ships a hand-picked `express` +
`compression`-only `package.json`), this module's packaging script ships
the full production `dependencies` block from the root `package.json` —
it doesn't try to guess which subset Nitro's bundler needs. This makes the
Hostinger `npm install` step larger and slower than Mode A's, which is the
correct tradeoff for actually running the SSR server rather than guessing
wrong and shipping a broken bundle. If Hostinger's "limited npm command /
global package execution" constraint causes any specific package to fail
installing, that's the concrete thing to report back — this doc can't
predict which package without seeing the actual error.

## Testing performed

- Syntax-checked `scripts/hostinger-package-node.mjs` with `node --check`
  — passes.
- Not run end-to-end (`npm run package:hostinger-node`) in this sandbox —
  a full `build:node` run previously hit this sandbox's memory limit
  (noted in Module 2) and a real zip upload to hPanel can't be verified
  without live Hostinger credentials. The script mirrors the pre-existing,
  working `hostinger-package.mjs` pattern closely (same staging/zip
  approach, same error-handling style) to minimize the risk of it being
  wrong in a way that isn't just "different output size."
- `npx tsc --noEmit` / `npm run test` — unaffected (this module only adds
  a build script and docs, no `src/` changes).

## Next step

Recommend actually running `npm run package:hostinger-node` yourself (or
having me attempt it, though the sandbox's memory limit may block the
`build:node` step — worth trying since real deploy environments typically
have more RAM than this sandbox) before the first real deploy, specifically
to confirm the `start-server.mjs` / `.output/server/index.mjs` path assumptions hold for the
Nitro version this project is pinned to.
