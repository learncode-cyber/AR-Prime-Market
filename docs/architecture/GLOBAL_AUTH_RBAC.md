# Global Authentication — RBAC Foundation (Module 3)

**Status:** RBAC foundation complete and tested. SSO/OIDC (true "global" identity
across future multi-brand services) explicitly NOT built — see "What this
module does NOT do" below; it needs a real decision on an identity provider.
**Depends on:** Module 2 (API Gateway)

## Important finding first (read before anything else in this doc)

While investigating the role model, I discovered that **`supabase/migrations/`
does not contain a baseline schema** — the earliest migration file
(`20260415040151_...sql`) already does `ALTER TABLE public.products ...`,
meaning `products`, `user_roles`, `app_role`, and most other core tables were
created outside this migrations folder entirely (almost certainly via direct
dashboard/Studio changes before migration tracking started).

**Practical consequence:** if anyone ever tries to spin up a fresh
Supabase project from `supabase/migrations/` alone (a new staging
environment, a disaster-recovery rebuild, a new developer's local instance),
it will fail — the migrations assume `user_roles`/`app_role`/`products`/etc.
already exist.

**I did not attempt to fix this in this module.** Reverse-engineering a
complete, correct baseline schema for 50+ tables from `types.ts` alone (my
only source in this sandbox, with no live DB connection) risks getting
constraints, defaults, and indexes subtly wrong — worse than leaving the gap
visible. The correct fix is to run `supabase db dump --schema public` (or
equivalent) against the **actual live project** and commit that as
migration `0`. This requires the project owner's Supabase CLI access and is
recommended as its own small, focused follow-up module.

## What was actually built

### 1. Confirmed the existing role model

`app_role` is a Postgres enum with **three** values: `"admin" | "moderator" |
"user"` (confirmed via the generated Supabase types). Before this module,
**every single check in the entire codebase only ever tested for `"admin"`**
— `moderator` existed at the database level with zero application code that
used it. This is exactly the kind of "half-built module" the original brief
asked to complete.

### 2. New migration (additive only, verified safe)

`supabase/migrations/20260722090000_a1e4f9b2-get-user-roles-rpc.sql` adds
one new function:

```sql
get_user_roles(p_user uuid) RETURNS app_role[]
```

Returns **all** roles for a user in one call, instead of calling `has_role()`
once per possible role. Does not touch `user_roles`, `app_role`, or
`has_role()` — all pre-existing and unchanged.

### 3. Gateway RBAC helpers (`src/lib/gateway/userAuth.ts`)

New, alongside the existing `isRequestFromAdmin` (kept as-is, unchanged):

```ts
type AppRole = "admin" | "moderator" | "user";
getRequestRoles(user): Promise<AppRole[]>
isRequestFromRole(user, role): Promise<boolean>
isRequestFromAnyRole(user, roles: AppRole[]): Promise<boolean>
```

### 4. `withGateway` gains a `requiredRoles` option

```ts
withGateway(
  { routeName: "moderate-review", auth: "user", requiredRoles: ["admin", "moderator"] },
  async (ctx) => {
    /* ... */
  },
);
```

`auth: "admin"` is unchanged (still admin-only, still uses `isRequestFromAdmin`).
`requiredRoles` is additive, for routes that should accept a **broader** set
of roles than just admin — e.g. a future "moderator can approve blog
comments but not touch payment settings" route.

### 5. `AuthContext` now exposes granular roles

```ts
const { isAdmin, roles } = useAuth();
// roles: string[] — e.g. ["admin"], ["moderator"], or [] for a plain customer
```

`isAdmin` is now **derived** from `roles.includes("admin")` — every existing
component reading `isAdmin` needs zero changes. This required changing the
RPC call inside `AuthContext` from `has_role(p_role: "admin")` to
`get_user_roles()`, but **the call count per identity-change is unchanged**
(still exactly one RPC round trip) — verified by the existing
"no double-load" test suite still passing unmodified in its assertions.

## What this module deliberately does NOT do

- **Wire moderator permissions into the ~150 `kali_master` admin routes.**
  The role now _exists and is checkable_ end-to-end, but deciding which of
  the 150 routes a moderator should/shouldn't access is a product decision,
  not an engineering one — flagged as a follow-up requiring your input on
  which admin sections map to which role.
- **True SSO/OIDC** for a future multi-brand "ARQ Master OS" scenario where
  one login works across several separate storefronts/services. Building
  this for real requires choosing an actual identity provider (Auth0,
  WorkOS, Keycloak, or Supabase's own multi-project federation options) —
  I'm not going to fake this with mock infrastructure that looks done but
  isn't; it needs a real provider decision and real credentials from you.
- **Fix the migration baseline gap** described above — flagged, not solved
  here, needs live DB access this sandbox doesn't have.

## Testing performed

- `npx tsc --noEmit` → **0 errors** (including a manual patch to
  `types.ts` adding `get_user_roles` to the generated Functions union —
  this will be superseded automatically the next time `supabase gen types`
  is run against the live project after the migration is applied).
- `npm run test` → **72/72 passed**, 10/10 files:
  - 4 new tests directly on `AuthContext`'s granular-roles behavior
    (multi-role exposure, moderator-only ≠ admin, empty roles for a plain
    customer, owner fast-path still short-circuits with zero RPC calls).
  - 7 new tests on the gateway's RBAC helper functions.
  - 3 new tests on `withGateway`'s `requiredRoles` enforcement.
  - All 3 pre-existing `AuthContext` "no double-load" tests pass **unmodified
    in their assertions** (only the mock's return shape was updated to match
    the new RPC's array contract instead of the old boolean).
- `npx eslint --fix` scoped to touched files — 0 errors, 2 pre-existing/
  unrelated warnings (not something this module introduced).

## Next step

Waiting for approval on:

1. Whether to invest in the **migration baseline reconciliation** as its own
   module (needs your Supabase CLI access to run against the live project).
2. Whether to move to **Module 4: Shared AI Memory** per the roadmap, or
   spend more time wiring the new `moderator` role into specific admin
   routes first (tell me which routes/sections if so).
