# Shared AI Memory (Module 4)

**Status:** Complete for the scope described below.
**Depends on:** Module 2 (API Gateway), Module 3 (Global Auth RBAC)

## Key finding: this mostly already existed — just on one runtime only

Before assuming a shared-memory system needed to be built from scratch, I
looked for one — and found a genuinely solid one already in place:
`agent_learning_logs` + `ceo_directives` + `agent_research_logs`, queryable
in a single round trip via the `get_agent_memory_context()` RPC, with a
clean loader/prompt-builder in
`supabase/functions/_shared/agent-identity.ts`.

**The gap:** that loader is Deno-only code, used by the CHRO orchestrator,
Telegram bot, and learning engine — all **Supabase Edge Functions**. The
customer-facing AI surfaces (`api/chat.ts` "Raiyan AI", `api/shopping-agent.ts`)
run in **Node** (TanStack Start), a separate runtime with no import path to
`supabase/functions/`. So the customer-facing assistant had zero access to
the same shared learnings the internal agent uses — each was building
context independently, which is exactly the problem the original brief's
"Shared AI Memory" item describes.

## What was built

**`src/lib/ai-memory/index.ts`** — a Node-side twin of the Deno loader,
reading the exact same `get_agent_memory_context()` RPC and therefore the
exact same underlying tables. Two runtimes, one shared source of truth —
no new storage, no new sync mechanism, no data duplication.

Two functions:

- `loadSharedAgentMemory(options)` — fetches directives/research/learning.
- `buildSharedLearningBlock(ctx)` — renders **only the locked, vetted
  learnings** (`is_locked = true`) as a compact block for a system prompt.
  Deliberately excludes CEO directives and research logs — those are
  internal-operations content not appropriate to expose to a customer-facing
  assistant. Deliberately excludes unlocked/provisional learnings — those
  are the CHRO agent's own working notes, not vetted facts ready for
  customer-facing use.

## Integration: all three Node-side AI surfaces now share this memory

- **`api/chat.ts`** ("Raiyan AI") — additive append, currency instruction
  left untouched (see discrepancy note below).
- **`api/shopping-agent.ts`** — additive append. This route was already
  USD-consistent with the CHRO agent's shared learning, so there was no
  conflict to flag here.
- **`src/lib/blog-ai.server.ts`** (cron-triggered blog generator) —
  additive append to the generation prompt, so blog content stays
  consistent with the same vetted brand/market facts the other two
  surfaces use.

All three follow the identical safe pattern: fetch wrapped in its own
try/catch, failure logs a warning and continues on the base prompt —
the shared-memory call can never break any of the three features.

## A real discrepancy this surfaced (flagged, not silently fixed)

While wiring this up, I found that `api/chat.ts`'s system prompt describes
AR Prime Market as **"a Bangladeshi e-commerce store (currency: BDT ৳)"**,
while the CHRO agent's locked shared learning says **"Pricing currency:
USD"** for the international target markets (USA/CA/UK/EU/AU/UAE). Checked
further: `CurrencyContext.tsx` treats BDT as the pivot currency (`rate: 1`)
that other currencies are converted from, while `orders.currency` defaults
to `'USD'` at the DB level. This could be an intentional dual-market model
(local BDT catalog pricing + USD conversion for international customers) or
it could be a genuine inconsistency between two AI agents' understanding of
the business.

**I did not resolve this** — I only made sure the new shared-learning block
never overrides or contradicts the existing BDT instruction, so this
module didn't silently change customer-facing pricing language. This needs
your call: is BDT-as-base intentional, and if so, should the CHRO agent's
"Pricing currency: USD" learning be corrected/clarified instead?

## What this module deliberately does NOT do

- **No new write path.** This module only reads shared memory into agent
  prompts. The existing `upsert_agent_learning()` RPC (write side) is
  untouched — none of the three surfaces wired here write learnings back;
  only vetted internal agents (CHRO, learning engine) should be adding to
  the shared "locked" fact store.
- **No semantic/vector search.** This is exact-match, tag/scope-filtered
  retrieval (fast, simple, and matches how the existing system already
  works) — not embeddings-based similarity search. If the learning log
  grows large enough that keyword/scope filtering stops being precise
  enough, that would be a distinct follow-up module (pgvector + embeddings),
  not something to bolt on speculatively now.

## Testing performed

- 9 unit tests on `loadSharedAgentMemory` / `buildSharedLearningBlock`
  (default options, custom options, success/error paths, partial-response
  handling, the locked-only filter, and the 20-entry cap).
- `npx tsc --noEmit` → **0 errors** across all three integration points.
- `npm run test` → **81/81 passed**, 11/11 files.
- `npx eslint --fix` scoped to touched files — 0 new errors introduced
  (one pre-existing `any`-typed catch in `blog-ai.server.ts`, on the exact
  line this module added, was cleaned up while there; the file's other
  8 pre-existing `any` usages elsewhere were left as documented lint debt,
  out of scope for this module).

## Next step

Waiting on:

1. Your call on the BDT/USD discrepancy above (`chat.ts` only).
2. Move to the next roadmap module (**Plugin System**), or wire a 4th
   surface if you have one in mind.
