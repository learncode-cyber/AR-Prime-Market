# Critical Fix: Server-Side Order Currency Bug (Module 20)

**Status:** Fixed, SQL-syntax-verified (cannot execute against a live DB
from this sandbox — see verification section). This was the most critical
finding of the entire engagement so far — it affects the actual amount
charged/recorded on real orders, not just a display issue.

## What was found

While investigating the coupon-currency question (Priority 1 item from the
Outstanding Items Report), reading the actual `create_order()` Postgres
function — the authoritative, server-side logic that runs when any order
is placed — revealed it had the exact same currency bug that Module 18
fixed on the client side, except here it's the number that actually gets
charged and permanently recorded:

1. `v_subtotal := v_subtotal + (v_unit_price * v_qty)` summed each line
   item's raw `price` with no currency conversion, regardless of each
   product's own `currency` column. A cart mixing a $25 USD item and a
   ৳500 BDT item would compute `v_subtotal = 25 + 500 = 525` — meaningless
   arithmetic mixing two different units.
2. The order's `currency` was hardcoded to `'USD'` in the `INSERT`
   statement, regardless of what currency the actual products were priced
   in. So even a correctly-summed non-USD total would be mislabeled.
3. `order_items.unit_price` stored the raw native-currency price while the
   order claimed `currency = 'USD'` — internally inconsistent with itself.

Client-side fixes (Module 18) could never have caught this — the client
only controls what's displayed before checkout; this function is what
actually executes when the "place order" button is pressed.

## What was built

### `fx_rates` table (new)

A small server-side reference table (`currency_code`, `rate_per_usd`,
`updated_at`), RLS-readable by everyone, writable only by admin/the sync
job. Seeded with the same rate values as the client's
`CurrencyContext.tsx` fallback table, so it's sane even before the sync
job has run once.

Why a stored table instead of a live API call during checkout: checkout is
a critical path — making it depend on a third-party FX API's
uptime/latency inside a database transaction would be fragile. Instead,
`sync-fx-rates` (new cron route, hourly) keeps this table fresh from the
exact same API the browser already uses, and `create_order()` reads from
this fast, reliable, local table.

### `to_usd(amount, currency)` helper function

Converts any amount to its USD equivalent using `fx_rates`. Fails safe: an
unrecognized currency code is treated as 1:1 (not rejected, not crashed)
— the least-harmful assumption when a currency isn't in the table yet,
rather than blocking a real customer's order over a data gap.

### `create_order()` — re-created with the fix

Signature is unchanged (drop-in replacement, no caller needs to change).
Every line item's price is now converted to USD via `to_usd()` before
being summed. `order_items.unit_price` now stores the USD-converted
amount too, so it's consistent with the order's own `currency = 'USD'`
label (matching what Module 19's receipt display —
`formatInCurrency(item.unit_price, order.currency)` — expects).

### New cron job: `fx-rates-sync-hourly`

`src/routes/api/public/cron/sync-fx-rates.ts` (Gateway-protected, `auth:
"cron"`, same pattern as every other cron route) fetches live rates from
`open.er-api.com/v6/latest/USD` and upserts into `fx_rates`. Scheduled via
the same `SECURITY DEFINER` + `pg_cron` pattern established in Module 9.

## Important limitation — stated plainly

This SQL cannot be executed from this sandbox (no live Postgres/Supabase
connection). Verification performed instead:
- Dollar-quote and parenthesis balance checks on the raw SQL (both
  migrations balanced).
- The function body was built by taking the exact original
  `create_order()` definition (read directly from its own migration file)
  and making the smallest possible targeted changes — adding `currency` to
  both `SELECT ... FROM products` calls, wrapping `v_unit_price` in
  `to_usd()` before summing, and using the converted amount when inserting
  `order_items` — rather than rewriting the function from scratch, to
  minimize the chance of introducing an unrelated regression in logic that
  was already working (stock decrementing, variant handling, coupon
  validation, email logging all copied verbatim, untouched).

Strongly recommend testing this for real before relying on it: place a
real test order (or use a staging Supabase project if you have one) with a
product priced in a non-USD currency, and confirm the resulting
`orders.total_amount` and `order_items.unit_price` are correct
USD-equivalent values.

## A mid-session incident, disclosed transparently

The sandbox this work is being done in crashed/reset partway through
delivering this module (an OOM kill during a zip operation, based on the
error). Everything in `/mnt/user-data/outputs/` from before the crash
survived (it's on separate storage), but the in-progress working directory
was lost. This module's files (both migrations, the new route, the
`types.ts` patch, this doc) were rebuilt from scratch immediately after
restoring the last verified full-project zip (modules 1–19) — same
content, re-verified with the same `tsc`/`test`/`eslint` checks as
everything else in this report. Mentioning this so the process stays
transparent, not because it changed the outcome.

## Node-side verification (what COULD be run)

- `npx tsc --noEmit` → 0 errors (including the manually-patched `fx_rates`
  table type in `types.ts`, needed since `supabase gen types` can't run
  against a live project from here — same pattern as Module 3's
  `get_user_roles` addition, will be superseded automatically next time
  types are regenerated for real).
- `npm run test` → 132/132 passed, 18/18 files.
- `npx eslint --fix` on `sync-fx-rates.ts` → 0 errors.
- Route tree regenerated for the new cron route.

## Also flagged again here (from the earlier report, now more precisely understood)

Fixed-amount coupons (`v_discount := COALESCE(v_coupon.discount_value,
0)`) are now subtracted from a USD-pivot `v_subtotal`, and the fix
documents this assumption directly in the SQL comment. The `coupons`
table still has no `currency` column — if your existing fixed-amount
coupons were created assuming BDT values, they will now discount the
wrong amount. This is unchanged from the original report item, just now
precisely located in the code that will actually execute it.

## Next step

1. Test this against a real/staging database before it handles real
   orders — this is the single highest-priority verification gap left in
   the whole engagement.
2. Check your coupon data for the fixed-amount-currency assumption above.
3. Continue down the Outstanding Items Report — next up per your
   instruction: the secret-inventory audit.
