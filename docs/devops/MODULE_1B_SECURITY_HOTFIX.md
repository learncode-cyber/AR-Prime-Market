# Module 1b — Critical Security & Type-Safety Hotfix

**Status:** Complete. All 29 tests pass (5/5 files), 0 TypeScript errors.
**Scope:** Fixed the 6 real issues surfaced by Module 1's CI validation.
**Non-goals:** Did not touch the ~8,600 pre-existing Prettier formatting
errors repo-wide — see "Deferred" below.

## 1. `chro-orchestrator` — public, unauthenticated business-agent endpoint (critical)

**Before:** `supabase/config.toml` set `verify_jwt = false` for this function,
and the function itself had **no internal auth check at all** — no
`CRON_SECRET`, no `requireAdmin()`. It can create sub-agents and route tasks
into `agent_proposals`. Anyone on the internet who knew the URL could call it.

**Fix:** Re-enabled `verify_jwt = true` in `config.toml`. Verified this is
backward compatible: the only caller (`telegram-webhook`) already sends the
Supabase **service-role key** as the `Authorization: Bearer` header, which is
itself a validly-signed JWT — it passes gateway verification unchanged.
Added `chro-orchestrator` to the test's `REQUIRED_PROTECTED` list so this
can't silently regress again.

## 2. XSS — unsanitized `dangerouslySetInnerHTML` in `blog.$slug.tsx` (high)

Two sites:

- **FAQ JSON-LD script tag** (`JSON.stringify(faqJsonLd)`): if any FAQ answer
  sourced from CMS content contained the literal string `</script>`, it would
  terminate the script tag early and allow HTML injection. Fixed by adding
  `src/lib/jsonLdScript.ts` → `toSafeJsonLdString()`, which escapes `<`, `>`,
  `&`, and line separators for safe script embedding. (Not a DOMPurify job —
  DOMPurify sanitizes HTML, not JSON, and running it over structured data can
  corrupt legitimate content.)
- **Blog post intro HTML** (`parsed.introHtml`): genuine CMS-sourced HTML with
  no sanitization. Fixed with `DOMPurify.sanitize(parsed.introHtml)`,
  consistent with how `post.content` was already handled two lines below it.

Updated `src/test/security/xss-sanitization.test.ts`'s regression guard to
recognize both `DOMPurify.sanitize(...)` and `toSafeJsonLdString(...)` as
valid safe patterns.

## 3. Ten edge functions flagged as "public but not allow-listed" (audited, no code changes)

Audited each of the 11 originally-flagged functions individually by reading
their source for internal auth enforcement:

| Function                 | Verdict                    | Why                                                          |
| ------------------------ | -------------------------- | ------------------------------------------------------------ |
| `cj-webhook`             | Legitimately public        | Verifies `x-cj-signature` HMAC in code                       |
| `get-user-geo`           | Legitimately public        | Read-only IP→geo, no sensitive data                          |
| `meta-capi`              | Legitimately public        | Layered check: internal secret OR admin JWT OR browser event |
| `meta-insights`          | Legitimately public        | Calls `requireAdmin(req)` internally                         |
| `telegram-notify`        | Legitimately public        | Verifies `x-cron-secret`                                     |
| `telegram-webhook`       | Legitimately public        | Verifies Telegram's own webhook secret                       |
| `ai-support-chat`        | Legitimately public        | Intentionally anonymous customer-facing chat                 |
| `daily-ceo-report`       | Legitimately public        | Verifies `x-cron-secret`                                     |
| `ad-performance-monitor` | Legitimately public        | Verifies `x-cron-secret`                                     |
| `ai-learning-engine`     | Legitimately public        | Verifies `x-cron-secret`                                     |
| `chro-orchestrator`      | **Not legitimate — fixed** | See #1 above                                                 |

The 10 legitimate ones were added to `PUBLIC_FUNCTIONS_ALLOWLIST` in the test,
each with an inline justification comment, so future changes to this set are
visible in code review instead of silently passing/failing CI.

## 4. `agent-research-loop` — unregistered in `config.toml`

Was missing a `[functions.agent-research-loop]` block entirely. Registered it
explicitly with `verify_jwt = false` (matches its siblings — code
self-enforces via `CRON_SECRET`) instead of leaving it on Supabase's implicit
default.

## 5. `AuthContext` — owner admin required a redundant RPC round-trip

The permanent owner account (`biz.arprimemarket@gmail.com`, seeded with the
admin role in migration `20260519040605`) was going through the same
`has_role` RPC check as every other user. Added a client-side fast path that
short-circuits for this one canonical email. **This is a UX/reliability
optimization only, not a new trust boundary** — the client's `isAdmin` flag
only gates UI routing (which panel to render); every actual data operation is
still independently enforced server-side by `has_role()` and RLS policies
regardless of what the client believes.

## 6. Two real TypeScript bugs (routing)

- `src/routes/cart.tsx`: had no `validateSearch`, so `?coupon=CODE` deep
  links typed as `{}`. Added `validateSearch` returning `{ coupon?: string }`.
- `src/routes/order.$ref.tsx` and `order-confirmation.$orderId.tsx`: their
  `<Navigate search={...}>` conditionally omitted the `token` key entirely,
  which didn't match `/thank-you`'s `validateSearch` shape (`token: string |
undefined` — key must be present, value may be undefined). Fixed by always
  including the key: `{ order: ref, token: token ?? undefined }`.

## Verification performed

- `npm run test` → **29/29 passed, 5/5 files**
- `npx tsc --noEmit` → **0 errors**
- `npx eslint --fix` run scoped only to the 8 touched files (formatting only,
  no logic changes) — repo-wide formatting left untouched, see below.

## Deferred (explicitly out of scope for this module)

- **~8,600 pre-existing Prettier formatting errors** repo-wide. Confirmed
  they are pre-existing (present before this module), not something this fix
  introduced. Left as a separate, dedicated **Formatting Normalization**
  module since fixing it touches nearly every file in the repo and deserves
  its own isolated, reviewable diff rather than being bundled into a security
  fix.
- **Rate limiting for `ai-support-chat`**, which is intentionally public.
  Flagged in the original audit (Section 6/13) and tracked for the Security
  module.
- **Full secret inventory audit** (confirming the ~20 service-role-key
  functions don't over-scope their DB access) — tracked for the Security
  module, not duplicated here.
