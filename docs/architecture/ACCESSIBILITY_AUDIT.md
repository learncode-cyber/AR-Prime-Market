# Accessibility Audit (Module 13)

**Status:** Highest-impact items fixed. Full remaining scope documented
below, not silently left undiscovered.

## Methodology (learned from Module 12's mistake — verified before claiming)

Given Module 12's false-positive lesson, this audit used stricter,
multi-line-aware pattern matching (Python/regex, not single-line grep) and
manually read every flagged instance in context before fixing anything.

## What was checked

1. **`<img>` tags without `alt`** — 53 found across the codebase, all
   confirmed to already have `alt` attributes (a naive single-line grep
   initially flagged 4 as suspicious; all 4 were false positives from
   multi-line JSX — verified by reading each one directly).
2. **Icon-only buttons with no accessible label** — found 107 candidates
   with a loose check, narrowed to **6 genuine cases** after requiring the
   button's entire content to be exactly one icon and nothing else (the
   loose check had many false positives from buttons with text like "PDF",
   "Add", "Reject" that a simpler regex missed).
3. **Form inputs with no label association** (no `aria-label`, no
   `id`/`htmlFor` pairing, no placeholder) — found 79 candidates.

## Fixed

### 6 icon-only buttons (added `aria-label`)

| File | Button | Label added |
|---|---|---|
| `components/admin/agent/ChatPanel.tsx` | Send | "Send message" |
| `routes/kali_master.orders.tsx` | more-actions dropdown | "Order actions" |
| `routes/kali_master.cj-settings.events.tsx` | Refresh | "Refresh events" |
| `routes/kali_master.cj-settings.events.tsx` | Trash | "Clear events" |
| `routes/kali_master.hero.tsx` | Trash | "Remove slide {n}" (dynamic) |
| `routes/kali_master.fake-orders.tsx` | Plus | "Add {label}" (dynamic, matches the file's existing "Remove {v}" pattern) |

### `src/routes/checkout.tsx` — the customer checkout form (highest priority)

**This was the most important fix in the audit.** Every `<Label>` in the
checkout form was visually positioned above its `<Input>`/`<Select>`/
`<Textarea>` but had **no `htmlFor`/`id` pairing** — meaning a screen
reader user tabbing into the "Full Name" field (for example) would not
have it announced as "Full Name," making the site's own checkout flow
effectively unusable for a screen-reader-dependent customer. This is the
single highest-traffic form on the entire site.

Fixed 9 of 10 fields: name, email, phone, address line 1, address line 2,
city (both the `<Select>` and `<Input>` variants it can render), state
(same), postal code, order note.

**Not fixed:** the Country field uses a custom `CountrySelectIntl`
component rather than a plain shadcn `Select`/`Input`. Wiring its
`id`/`htmlFor` correctly requires seeing that component's internal
implementation first — guessing at its prop API risked silently breaking
it. Flagged rather than guessed.

## NOT fixed in this module — real, sized remaining scope

Of the 79 flagged form-input instances, only checkout.tsx's 9 were fixed.
The remaining ~70 are concentrated in:

| File | Approx. count | Priority |
|---|---|---|
| `kali_master.settings.tsx` | 5 | Medium (admin-only, staff accessibility) |
| `kali_master.coupons.index.tsx` | 4 | Medium |
| `kali_master.ads-automation.tsx` | 1+ | Low |
| `kali_master.image-optimization.tsx` | 1+ | Low |
| Various other `kali_master.*` admin routes | ~55 | Low-medium (admin-only) |

All of these are **admin-only** (not customer-facing), which is why they
were deprioritized behind the checkout form in this pass — genuinely worth
fixing (any admin staff member using assistive technology deserves the
same working experience), but a lower-urgency, larger-volume follow-up
better scoped as its own module given the count.

## Testing performed

- `npx tsc --noEmit` → **0 errors**.
- `npm run test` → **123/123 passed**, 17/17 files (unchanged — this
  module made no logic changes, only added `id`/`htmlFor`/`aria-label`
  attributes, which don't affect component tests).
- `npx eslint --fix` scoped to touched files — 0 new errors (16
  pre-existing `@typescript-eslint/no-explicit-any` errors surfaced in
  files touched, all on `as any` casts that predate this module's edits —
  same documented type-safety debt as Modules 11/12).

## Next step

The remaining ~70 admin-form label associations are a well-scoped,
mechanical follow-up (same fix pattern as checkout.tsx, just more files) —
good candidate for the next session if accessibility work continues, or
can be folded into whatever "admin panel polish" work happens next.
