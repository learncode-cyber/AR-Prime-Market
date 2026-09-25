# Role/Access Audit (Module 12)

**Status:** Complete. 2 real fixes applied, 1 shared helper added, 17 files
verified safe (initial broader concern was a false alarm — see below).

## What was requested

A systematic check of whether every admin-facing server function actually
enforces admin/role access, not just the client-side UI gate.

## Methodology (and an honest correction mid-audit)

**First pass (grep-based, imprecise):** searched all 29 `.functions.ts`
files for `has_role|isAdmin|requireAdmin|get_user_roles|requireAnyRole`.
24 files had no match. Of those, 19 also used `supabaseAdmin` (the
service-role client, which bypasses RLS entirely) — initially reported as
"19 vulnerable files."

**That number was wrong, and I said so before pursuing it further.** Manually
reading each flagged file's handler body revealed admin checks exist in
several styles this codebase doesn't apply consistently:

- A local named helper, e.g. `assertAdmin(userId)` in
  `security-patches.functions.ts` (queries `user_roles` directly).
- An inline query right in the handler, e.g. `agent-chat.functions.ts`,
  `ai-architect.functions.ts`, `blog-logs.functions.ts`:
  `.from("user_roles").eq("role","admin")` written out each time.
- Enforcement one layer down, e.g. `storage-migration.functions.ts`
  delegates to `storage-migration.server.ts`, which calls its own
  `requireAdmin()` — invisible to a grep of the `.functions.ts` file alone.
- Enforcement inside a Postgres RPC itself, e.g.
  `image-optimization.functions.ts`'s write path calls
  `set_integration_secret()`, whose SQL body has
  `IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION` — verified by
  reading the actual migration SQL, not just the TypeScript.
- Self-scoping by the caller's own `userId` instead of a role check at all
  — correct and sufficient for genuinely per-user data, e.g.
  `mfa-recovery.functions.ts` (a user's own MFA recovery codes) and
  `raiyan-ai.functions.ts` (a user's own AI chat thread history), both of
  which filter every query by `eq("user_id", userId)` using the caller's
  own id from their session — there is no "other user's data" for these
  to leak.

None of these patterns match a simple keyword grep, which is why the first
pass overcounted. After manually reading all 24 originally-flagged files:
**17 were already correctly protected** (via one of the patterns above),
and only 2 had a genuine gap.

## The 2 real findings, fixed

### 1. `uploadToR2` (`src/lib/r2-upload.functions.ts`) — real, moderate severity

Had `requireSupabaseAuth` only (any logged-in session) with no role check
of any kind, in any layer. Its only caller in the entire codebase is
`kali_master.hero.tsx` (the admin hero-banner image uploader) — meaning it
was never meant to be customer-reachable. Any account holder could have
called it directly (bypassing the UI entirely, since this is a real HTTP
endpoint) to upload arbitrary files up to 25MB to R2 storage and receive a
public URL back — a resource-abuse and potential content-hosting-abuse
vector. **Fixed:** added `requireAdmin(context.supabase, context.userId)`
at the top of the handler.

### 2. `getImageOptimizationSettings` (`src/lib/image-optimization.functions.ts`) — low severity, hardened anyway

Read-only, and doesn't return any secret (the underlying API key is never
in the response — the write path was already correctly protected via the
`set_integration_secret` RPC's internal check). Still business-wide
config, so gated for consistency with every other settings-read endpoint
in the codebase, rather than being the one silent exception.

## New shared helper: `src/lib/server-auth.ts`

```ts
requireRole(supabase, userId, roles: string[]): Promise<void>  // throws 403 Response if none match
requireAdmin(supabase, userId): Promise<void>                   // shorthand for requireRole(..., ["admin"])
```

Used for the 2 fixes above. **Not** retroactively forced onto the 17
already-safe files — they're correctly protected via their existing
patterns, and rewriting working, verified code to use a new helper for
style consistency alone would be exactly the kind of unnecessary refactor
the project's own ground rules warn against. `arq-os.functions.ts` (Module
6) keeps its own near-identical local `requireAnyRole` rather than being
migrated to this shared one in this pass, for the same reason — it works,
it's tested, and touching it risks its existing passing tests for no
functional gain.

**Worth doing later, not now:** consolidating all ~6 different
admin-check styles onto this one shared helper would reduce the exact risk
that made this audit hard (a human — or an AI — grepping for "is this
protected?" and getting the wrong answer because the style varies). Flagged
as a real future hygiene improvement, scoped separately since it would
touch many files for zero behavior change, same reasoning as the
Formatting Normalization module.

## Testing performed

- 8 new unit tests on `requireRole`/`requireAdmin` (role match, role
  mismatch, RPC error fails closed, malformed RPC response fails closed,
  correct RPC argument passing, the 403 body content, and the `requireAdmin`
  shorthand).
- `npx tsc --noEmit` → **0 errors**.
- `npm run test` → **123/123 passed**, 17/17 files.
- `npx eslint --fix` scoped to touched files — 0 new errors (1 pre-existing,
  unrelated `no-useless-escape` regex lint issue elsewhere in
  `r2-upload.functions.ts`, far from the fix, left as documented debt).

## What was NOT audited in this pass

This covered the 29 `.functions.ts` files (the newer `createServerFn`
layer). It did **not** cover:
- The ~150 `kali_master.*.tsx` route files' direct Supabase queries (many
  read data via `useQuery` calling Supabase directly from the client,
  relying entirely on RLS rather than a server function) — RLS coverage
  was checked at a high level in the original audit (36/101 migrations
  enable RLS, 207 policies) but not re-verified table-by-table here.
- The 25 Supabase Edge Functions — Module 1b already did a focused pass on
  their `verify_jwt` gateway config; their internal logic wasn't
  re-audited for role checks here.

Both are reasonable candidates for a future, similarly-scoped audit if
wanted.
