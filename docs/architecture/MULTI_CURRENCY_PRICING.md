# Multi-Currency Pricing System (Module 18)

**Status:** Core system rebuilt and verified. Some downstream areas
(fixed-amount coupons, historical order display) flagged as follow-ups,
not yet touched.

## What you asked for

Admin enters a price in whatever currency they choose in the admin panel;
every customer sees it correctly live-converted to their own currency at
the real exchange rate (example given: $3 USD entered, shown as ৳390 to a
BDT customer at a 130/USD rate).

## Root cause of why this didn't work before

The whole pricing display system assumed every stored price was in BDT
(`convertPrice`'s parameter was even named `bdtPrice`, and its rate table
was BDT-relative). But the actual data — both demo products and the real
CJ Dropshipping import pipeline — stores prices in USD. And the admin
product form had **no currency selector at all**: the price field was
hardcoded labeled "Price (৳)" with no way to say "this number is dollars."
The `product.currency` database column existed and was even populated by
imports, but **nothing in the entire display layer ever read it.**

## What was rebuilt

### 1. `CurrencyContext.tsx` — USD-pivot conversion

- Rate table rebuilt with **USD as the pivot** (rate = units of X per 1
  USD) instead of BDT. The underlying real-world exchange rate numbers
  were correct — only the pivot currency was wrong — so this was a
  mechanical inversion, not a re-guess.
- Live rate fetch now pulls from `open.er-api.com/v6/latest/USD` instead
  of `/latest/BDT`.
- `convertPrice(price, fromCurrency = "USD")` and
  `formatPrice(price, fromCurrency = "USD")` now take a **source
  currency** and convert correctly from ANY currency to whatever the
  customer has selected — not just "from BDT."

### 2. Every price-display call site updated to pass the product's real currency

`ProductCard`, `ProductQuickViewDialog`, `RelatedProducts`,
`RecentlyViewed`, `QuickCheckoutModal`, `CartDrawer`, `cart.tsx`,
`products.$slug.tsx`, `wishlist.tsx`, `AdvancedSearch.tsx`,
`VariantSelector` (needed a new `currency` prop), `BundleOfferPicker`
(same), `TrustBadges` (simplified — no longer needs to convert-through-BDT
as an intermediate step now that USD is the pivot).

### 3. Two more hardcoded-BDT bugs found and fixed while doing this

- **`wishlist.tsx`**: its own separate query hardcoded `currency: "BDT"`
  on every wishlist item regardless of the product's real currency — now
  selects and uses the real `products.currency` column.
- **`useRecentlyViewed.ts`**: the localStorage-persisted record didn't
  store currency at all — added the field and updated the one call site
  (`products.$slug.tsx`) that saves a view.

### 4. Cart totals — the mixed-currency-arithmetic problem

If a cart contains items priced in different currencies, naively summing
raw `price` values is meaningless (adding a $25 number to a ৳500 number).
`CartContext.tsx` now converts **each line item to USD individually**
before summing (`lineToUsd`), so `subtotal` is always a well-defined
USD-pivot number regardless of what currencies are actually in the cart.
Every consumer of `subtotal` now calls `formatPrice(subtotal, "USD")`
explicitly rather than assuming an implicit currency. Also fixed the
Meta Pixel `AddToCart` event, which was reporting a raw un-converted price
tagged with the customer's active currency code (a value/currency
mismatch that would have skewed ad-platform conversion-value reporting).

### 5. Admin product form — the actual fix you asked for

`kali_master.products.tsx`'s price field was `Label>Price (৳)</Label>`
with no currency choice. Now: a currency dropdown (USD, BDT, AED, SAR,
EUR, GBP, CAD, AUD) sits next to the price input, defaults to USD
(matching the real import pipeline), is included when creating/updating a
product, and is loaded correctly when editing an existing product.

### 6. Bug caught and fixed during this work

While editing `CartContext.tsx`, a `str_replace` operation accidentally
deleted the `cartKey` helper function it was supposed to leave untouched.
Caught immediately by re-running `tsc --noEmit` right after (0 → would
have been several errors), restored before moving on. Flagging this
transparently rather than not mentioning it — it's exactly the kind of
mistake continuous verification is meant to catch, and it worked.

## Verified

- Manual calculation check matches your example exactly: admin enters
  price=3, currency="USD" → customer viewing in BDT at rate 130 sees
  formatPrice(3, "USD") = 3 × 130 = **৳390**. ✓.
- `npx tsc --noEmit` → 0 errors.
- `npm run test` → 132/132 passed, 18/18 files (unchanged — this system
  has no existing unit test coverage; it's UI/context code, not the
  server-side modules the test suite covers. Verification here is
  typecheck + manual calculation + code-path tracing, not automated
  component tests).
- `npx eslint --fix` — 0 new errors (pre-existing `any`-typed debt on
  untouched lines, same pattern as every prior module).

## NOT yet touched — flagged, not fixed

1. **Fixed-amount coupons** (`useCoupon.ts`): a percentage discount
   (`discount_type: "percentage"`) is currency-agnostic and unaffected by
   any of this. A **fixed-amount** discount (`discount_value` as a flat
   number) is subtracted directly from the now-USD-pivot subtotal — this
   assumes existing coupon `discount_value` entries are meant to be USD.
   The `coupons` table has no currency column (same pre-existing
   migration-baseline gap noted in Module 3). If your existing fixed
   coupons were created assuming BDT, they'll now discount the wrong
   amount. Worth checking your actual coupon data before relying on fixed
   discounts.
2. **Order history / thank-you / track-order pages** (`account.tsx`,
   `thank-you.tsx`, `track-order.tsx`): these display `order.total_amount`
   and `item.unit_price` from the `orders`/`order_items` tables, which
   have their OWN `currency` column (captured at checkout time) — a
   fundamentally different, and arguably correct-as-is, concept: a
   completed order should keep showing the currency/amount it was
   actually paid in, not get re-converted at today's exchange rate. Not
   changed in this pass since it needs its own careful look at whether the
   current display already handles this correctly or has the same bug —
   didn't want to guess on financial history records.
3. **Affiliate commission amounts** (`account.affiliate.tsx`) — not
   audited in this pass.

## Next step

Recommend checking item #1 (existing coupon data) before this goes live
with real fixed-amount coupons, and let me know if you want #2 and #3
audited with the same rigor next.
