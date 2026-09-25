# CI Pipeline

**Module:** Phase 0 — DevOps & Security Guardrails
**File:** `.github/workflows/ci.yml`
**Status:** Production ready
**Owner:** Platform / DevOps

## What it does

Every pull request into `main`, and every push to `main`, runs five jobs:

| Job               | Command                   | Purpose                                                          |
| ----------------- | ------------------------- | ---------------------------------------------------------------- |
| `lint`            | `npm run lint`            | ESLint — code style + common bug patterns                        |
| `typecheck`       | `npx tsc --noEmit`        | Full TypeScript project typecheck, no emit                       |
| `test`            | `npm run test` (vitest)   | Unit + security test suite (`src/test/security/*`)               |
| `build`           | `npm run build:node`      | Verifies the Node/SSR (Nitro) deploy target still compiles       |
| `build-hostinger` | `npm run build:hostinger` | Verifies the static Hostinger shell deploy target still compiles |

`build` and `build-hostinger` only run if `lint`, `typecheck`, and `test` all pass —
fail fast, don't waste CI minutes building a broken app.

## Anti-regression floor

The `test` job hard-fails if the number of `*.test.*` files under `src/` drops
below **6** (the count at the time this pipeline was introduced). This does not
guarantee coverage quality, but it makes it impossible to silently delete tests
in a PR without CI noticing. This floor must be raised every time new test
files are intentionally added (see `docs/devops/TESTING.md`, added in the
Testing module).

## Environment in CI

CI never uses real secrets. Placeholder `VITE_SUPABASE_*` / `SUPABASE_*` values
are injected via the workflow's `env:` block so that build-time env validation
in `vite.config.ts` / server bootstrap does not fail. No CI job talks to a real
Supabase project, sends real emails, or calls real payment/AI provider APIs.
This is intentional — CI is a **static correctness gate**, not an integration
test environment. Integration/e2e testing against a real staging Supabase
project is a separate concern (see `docs/devops/TESTING.md`).

## Branch protection (manual setup required once, in GitHub repo settings)

To make this pipeline actually enforce quality, enable in
**Settings → Branches → Branch protection rule for `main`**:

- Require status checks to pass before merging: `lint`, `typecheck`, `test`, `build`, `build-hostinger`
- Require branches to be up to date before merging
- Do not allow bypassing the above settings (including for admins, if your plan supports it)

This step cannot be done from the codebase — it's a one-time GitHub repo
settings change the repo owner must apply.

## What this module deliberately does NOT do yet

- No automated **deployment** (CD) — deploys remain manual via
  `scripts/hostinger-deploy.mjs` until the CD module is approved and added as
  `.github/workflows/cd.yml`.
- No e2e browser tests (Playwright) — tracked as a Testing-module follow-up.
- No dependency vulnerability scanning (Dependabot/`npm audit` gate) — tracked
  as a Security-module follow-up, to avoid scope-creeping this module.
