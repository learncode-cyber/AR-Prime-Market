# Formatting Normalization (Module 11)

**Status:** Complete.

## What was done

Ran `npm run format` (`prettier --write .`) repo-wide — the deferred item
flagged since Module 1b's audit. This touched every file across `src/`,
`supabase/functions/`, and config files that had drifted from Prettier's
formatting rules (the codebase appears to have never had this run
consistently before).

Two files (`BundleOfferPicker.tsx`, `ChatWidget.tsx`) had a couple of
residual formatting disagreements Prettier's `--write` pass didn't fully
resolve on the first run — fixed with a follow-up `eslint --fix` pass
scoped to just those two files.

## Result

| | Before | After |
|---|---|---|
| Total lint problems | 8,524 errors | 537 (501 errors, 36 warnings) |
| `prettier/prettier` violations | ~8,000+ | **0** |
| `@typescript-eslint/no-explicit-any` | (not separately tracked before) | 470 |
| `react-refresh/only-export-components` | — | 27 (warnings, non-blocking) |
| `@typescript-eslint/ban-ts-comment` | — | 15 |
| `react-hooks/exhaustive-deps` | — | 7 |

**94%+ reduction**, and what's left is no longer formatting noise — it's
real type-safety debt (`any` usage, `@ts-ignore`/`@ts-expect-error`
comments, missing hook dependencies) that needs per-instance human
judgment to fix correctly, not a mechanical `--fix`. Blindly auto-fixing
470 `any` types would mean guessing at real types without the business
context to know if the guess is right — that's a separate, deliberately
scoped module (see "Next step" below), not something to rush through here.

## Why this was safe to run as one big diff

Formatting-only changes (whitespace, quote style, line wrapping) cannot
change runtime behavior — verified by re-running the full test suite and
typecheck immediately after, both identical to the pre-formatting baseline
(0 typecheck errors, 115/115 tests passing, same as before). This is
exactly the kind of large-diff-but-zero-risk change that's safe to do in
one pass, unlike the `any`-type cleanup which needs to be done file by
file with real review.

## Testing performed

- `npx tsc --noEmit` → **0 errors** (before and after — unchanged).
- `npm run test` → **115/115 passed**, 16/16 files (before and after — unchanged).
- `npx eslint .` → confirms 0 remaining `prettier/prettier` violations.

## Next step

The remaining 501 real lint errors are a legitimate future module
("Type Safety Cleanup" — replacing `any` with real types file by file,
reviewing each `@ts-ignore`/`@ts-expect-error` to see if it's still
needed, fixing genuine hook dependency gaps). Given the volume (470 `any`
usages), this would need to be its own multi-session effort, not bundled
into this one.
