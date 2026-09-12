# ARQ Master OS Core (Module 6)

**Status:** Proposal approval control plane complete and tested. "Apply"
(executing an approved proposal's payload) explicitly NOT built — see below.
**Depends on:** Module 2 (API Gateway pattern), Module 3 (RBAC), Module 5
(this is the first module to actually use the moderator role for something
real — viewing the proposal queue).
**Assumption used:** (C) from `ARQ_MASTER_OS_INTEGRATION_PLAN.md` —
formalizing the existing `kali_master` + `chro-orchestrator` system into a
real control plane, since no external ARQ OS reference exists anywhere in
the codebase.

## The gap this module closes

`chro-orchestrator` (a Supabase Edge Function) routes tasks to 4 sub-agents
— Security, Dev, Marketing, Growth — each of which produces a plan and
writes it to `agent_proposals` with `status = "pending"`. The table's own
schema (`status: pending | approved | applied | rejected`, plus
`decision_note`, `decided_at`, `applied_at` columns) makes the intended
workflow obvious: an admin should review each plan and approve or reject it.

**Before this module, that admin side did not exist anywhere.** No route,
no page, no server function ever read `agent_proposals` or `sub_agents`.
Proposals were being created and then sitting in the database forever,
invisible. This is exactly the kind of "half-built module" the original
brief's "complete all missing modules" item was written for.

## What was built

### `src/lib/arq-os.functions.ts`

Three `createServerFn`s, following the exact same pattern as the
pre-existing `audit-log.functions.ts` (auth via `requireSupabaseAuth`
middleware, then a role check via RPC):

- **`listSubAgents`** — admin or moderator. Registry view: name, role,
  capabilities, success/failure counts, last error.
- **`listAgentProposals`** — admin or moderator. Filterable by status.
- **`decideAgentProposal`** — **admin only.** Records approve/reject +
  optional note. Refuses to act on a proposal that isn't currently
  `"pending"` (can't re-decide an already-decided proposal).

The read/write role split (`["admin", "moderator"]` for viewing,
`admin`-only for deciding) is this module's first real use of the granular
RBAC built in Module 3 — a moderator can now watch what the agent network
is proposing without being able to greenlight anything itself.

### `src/routes/kali_master.arq-os.tsx`

New admin page at `/kali_master/arq-os`, added to the sidebar nav. Mirrors
the pre-existing `security-alerts` page's UI pattern closely (same
tab/card/approve-reject-with-note structure) for consistency — an admin
already familiar with that page will find this one immediately familiar.

### Route tree regeneration

Adding a new file under `src/routes/` requires TanStack Router's generated
`src/routeTree.gen.ts` to be updated (it's auto-generated, normally
produced by the Vite plugin during `dev`/`build`). Regenerated it directly
via the `@tanstack/router-generator` package's `Generator` API and verified
the diff only added the one new route's entries — nothing else changed.

## What this module deliberately does NOT do: "apply"

"Approved" currently means **"an admin has reviewed and greenlit this
plan"** — nothing more. It does not:

- Write the files a "dev" proposal's payload contains.
- Run the SQL a "security" proposal's payload contains.
- Launch the ad campaigns a "marketing" proposal's payload contains.
- Execute the experiments a "growth" proposal's payload contains.

Building "apply" means giving an automated system the ability to write to
the live codebase or spend ad budget with no further human step. That is a
fundamentally different risk category than anything else built across
Modules 1–6, and deserves its own dedicated design conversation — likely
starting with "dev" proposals specifically requiring a PR-based flow (open
a pull request for human review rather than committing directly) rather
than direct application, given the severity of what a bad "dev" payload
could do. Flagging this clearly rather than quietly building it as a
sub-feature of this module.

## A second confirmation of the Module 4 BDT/USD finding

While reading the sub-agent seed data (migration
`20260613042029_...`), the **Marketing Expert sub-agent's own system
prompt** explicitly states: _"Never mention Bangladesh/BDT/Dhaka in public
copy."_ This is independent, strong evidence that `api/chat.ts`'s hardcoded
"Bangladeshi e-commerce store, currency BDT" framing (flagged in Module 4's
doc) is a genuine inconsistency with the business's own stated rules, not
an intentional dual-market design choice. Still not silently changed here —
still your call — but now with corroborating evidence from a second,
independent source in the codebase.

## Testing performed

- 5 unit tests on `requireAnyRole` (the RBAC gate used by the two read
  functions) — role match, role mismatch (fail closed), RPC error (fail
  closed, not open), malformed RPC response (fail closed), correct RPC
  argument passing.
- Consistent with this codebase's existing test coverage convention: no
  `createServerFn` handler anywhere (old or new) is unit-tested directly —
  matches the pre-existing `audit-log.functions.ts`, which also has none.
  Full end-to-end verification of the three server functions would need a
  live Supabase project.
- `npx tsc --noEmit` → **0 errors** (including the regenerated route tree).
- `npm run test` → **107/107 passed**, 15/15 files.
- `npx eslint --fix` scoped to touched files — 0 new errors (2 pre-existing,
  unrelated `any` casts in `AdminSidebar.tsx`, far from the 2 lines this
  module touched there, left as documented debt).

## Next step

Waiting on:

1. Whether to design the "apply" flow (recommend starting with a PR-based
   review flow for "dev" proposals specifically, given the risk).
2. Or move to the remaining SEO/Performance/Monitoring/Testing items from
   the original brief's checklist.
3. Your call on the BDT/USD discrepancy (now flagged twice, independently).
