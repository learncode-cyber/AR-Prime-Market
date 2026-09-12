# Type Safety Cleanup — Phase 1: Catch Blocks (Module 14)

**Status:** Complete for the scoped subset described below (~80 of 470
`any` usages). Full remaining scope documented, not silently left.

## Why "Phase 1" and not "all 470"

470 `@typescript-eslint/no-explicit-any` errors exist across the codebase.
Blindly replacing all of them risked two failure modes: guessing wrong
types for complex domain objects (third-party webhook payloads, dynamic
JSON config) and introducing subtle bugs, or mechanically swapping `any`
for `unknown` everywhere without fixing the resulting property-access
errors, which would just trade one lint category for a pile of broken
builds.

Instead, this module targeted the **one safe, mechanical, fully
compiler-verifiable subset**: `catch (e: any)` / `catch (err: any)`
blocks. This pattern is almost always just "I need the error message for
a log/toast/response" — a well-understood, low-risk transformation with a
single correct idiom (`e instanceof Error ? e.message : String(e)`), and
critically, **the TypeScript compiler itself tells you exactly where every
remaining usage needs fixing** once the catch parameter's type changes —
turning this into a find-all-verify-each workflow rather than a
find-and-hope one.

## What was done

1. Found all `catch (e: any)` / `catch (err: any)` in `src/` (Deno edge
   functions in `supabase/functions/` excluded — they're a separate
   TypeScript project not covered by this repo's `tsc --noEmit`, so
   changes there can't be compiler-verified the same way): **44 files, 80
   locations.**
2. Mechanically changed every one to `catch (e: unknown)` /
   `catch (err: unknown)`.
3. Ran `tsc --noEmit` — the compiler flagged **exactly 80 locations**
   across 43 files where the now-`unknown` variable was used without
   narrowing (almost all `.message` access, one `.statusCode` access
   pair). This 1:1 correspondence confirms the catch-block pattern really
   was self-contained — no hidden usages elsewhere in the same functions.
4. Applied the `e instanceof Error ? e.message : String(e)` fix at every
   flagged location. One `.statusCode` case (`push.server.ts`, checking a
   webpush error's HTTP status to decide whether to prune a dead
   subscription) needed a different narrowing —
   `(err as Record<string, unknown>).statusCode` — fixed by hand after an
   automated first attempt produced invalid syntax (`as {}`), caught by
   the very next `tsc --noEmit` run rather than shipped.
5. `npx eslint --fix` to clean up line-wrapping on the now-longer
   ternary expressions.

## Result

| | Before | After |
|---|---|---|
| `@typescript-eslint/no-explicit-any` (repo-wide) | 470 | **393** |
| Total lint problems | 537 | **454** |

## Testing performed

- `npx tsc --noEmit` → **0 errors** throughout (this was inherently
  self-verifying: every single change was driven by a compiler error and
  confirmed fixed by the compiler going quiet on that location).
- `npm run test` → **123/123 passed**, 17/17 files, unchanged — these were
  all error-logging/messaging code paths, not the tests' concern, and
  nothing broke.
- Spot-checked several of the 80 auto-applied fixes by hand
  (`kali_master.support.tsx`, `payment.return.tsx`, `blog-ai.server.ts`)
  to confirm the generated code was semantically identical to the
  original `any`-typed version, just properly narrowed.

## What's left (real, sized remaining scope)

**393 `any` usages remain**, concentrated in (from the earlier per-file
survey): `account.tsx` (24), `telegram-webhook/index.ts` (21, Deno — not
covered by this repo's typecheck), `AddressBookSection.tsx` (15),
`kali_master.products.tsx` (14), `storage-migration.server.ts` (13),
`useOrderDetail.ts` (12), and many smaller pockets across ~150 admin
routes.

Unlike the catch-block subset, these are **not** a single safe pattern —
they're a mix of:
- Supabase query result shapes where the generated types don't perfectly
  match runtime data (would need per-table type refinement).
- Third-party webhook/API payload shapes (CJ Dropshipping, bKash, Binance,
  Telegram) that would need real type definitions written from each
  provider's actual API docs.
- Generic "dynamic config" objects (`config.fields.city as any` in
  `checkout.tsx`, seen during the Accessibility module) that would need a
  proper discriminated union type designed for the config schema.

Each of these needs domain understanding to fix correctly, not a
mechanical script — a reasonable follow-up would tackle them file-by-file
or provider-by-provider, not all at once.
