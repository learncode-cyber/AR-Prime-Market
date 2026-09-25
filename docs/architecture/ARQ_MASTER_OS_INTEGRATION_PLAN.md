# ARQ Master OS — Integration Plan

**Status:** Draft plan for approval. No implementation started on this module yet.
**Depends on:** Module 1 (DevOps Guardrails) ✅, Module 1b (Security Hotfix) ✅

## 0. Working assumption (please confirm before I build)

The original brief lists "Build ARQ Master OS integration" as a task without
defining what ARQ Master OS _is_ — whether it's:

**(A)** A **future central hub** that will manage multiple brands/stores
(AR Prime Market being one "spoke"), which doesn't exist yet and needs to be
designed from scratch, or
**(B)** An **existing external system** (already running somewhere) that this
codebase needs to integrate with via a defined API contract, or
**(C)** A **rename/formalization** of what already exists here — the
`kali_master` admin console + `chro-orchestrator` agent network — into a
proper "OS" architecture, rather than a separate system.

I'm proceeding on **assumption (C)** below, since that's what the codebase
evidence supports (no external ARQ OS reference exists anywhere in the repo,
but there's already a clear internal command-center pattern in `kali_master`

- `chro-orchestrator` + `sub_agents`). If you meant (A) or (B), tell me and
  I'll redraw this plan — the API contracts below would need a real external
  endpoint to target instead of being internal.

## 1. What "connect A-to-Z via API" means concretely

Every module in the roadmap becomes a **service with a defined API surface**
that plugs into one **API Gateway**, which is what "ARQ Master OS" talks to.
Nothing talks to Supabase directly anymore except the gateway layer itself.

```
                        ┌─────────────────────────┐
                        │   ARQ Master OS (hub)    │
                        │  (kali_master, formalized)│
                        └────────────┬─────────────┘
                                     │ single API contract
                        ┌────────────▼─────────────┐
                        │      API Gateway          │
                        │ (auth, rate-limit, audit,  │
                        │  request signing, routing) │
                        └──┬──────┬──────┬──────┬────┘
                 ┌─────────┘      │      │      └─────────┐
                 ▼                ▼      ▼                ▼
          Global Auth      Shared AI    Plugin        Domain APIs
          (identity,       Memory       System        (catalog, orders,
           RBAC, SSO)      (pgvector    (suppliers,     customers, SEO,
                            embeddings)  payments,       analytics...)
                                         AI providers)
```

Every box above is a **module** from the roadmap. Each one exposes a small,
versioned API (`/api/v1/<domain>/...`) instead of being called ad hoc from
scattered files — that's the literal meaning of "connected A to Z via API."

## 2. What gets added, module by module

| #   | Module                                                              | What it adds                                                                                                                                                                                                                                                                 | API surface it exposes                                                     |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | ✅ DevOps Guardrails                                                | CI, env hygiene, docs                                                                                                                                                                                                                                                        | —                                                                          |
| 1b  | ✅ Security Hotfix                                                  | XSS fix, auth-gate fixes, 2 TS bugs                                                                                                                                                                                                                                          | —                                                                          |
| 2   | **API Gateway**                                                     | Single ingress for all server-side calls: auth check, rate limit, request logging, consistent error shape                                                                                                                                                                    | `/api/v1/*` — every domain route below is _mounted under_ this             |
| 3   | **Global Authentication**                                           | Unifies storefront customer auth + `kali_master` admin auth into one identity system with proper RBAC (not just `is_admin` boolean)                                                                                                                                          | `/api/v1/auth/session`, `/api/v1/auth/roles`                               |
| 4   | **Shared AI Memory**                                                | `pgvector` embeddings table + retrieval API so CHRO orchestrator, Raiyan AI (shopping assistant), blog AI, and voice agent stop rebuilding context independently                                                                                                             | `/api/v1/memory/query`, `/api/v1/memory/write`                             |
| 5   | **Plugin System**                                                   | Formal interface (`SupplierPlugin`, `PaymentPlugin`, `AIProviderPlugin`) so CJ Dropshipping/AliExpress/Spocket and bKash/Binance become swappable implementations instead of hardcoded modules                                                                               | `/api/v1/plugins/register`, `/api/v1/plugins/:id/invoke`                   |
| 6   | **ARQ Master OS core**                                              | Formalizes `kali_master` + `chro-orchestrator` + `sub_agents` into the actual "OS" — a single orchestration layer that routes tasks to sub-agents, enforces the approval workflow, and is the _only_ thing allowed to call the Plugin System or trigger cross-domain actions | `/api/v1/arqos/agents`, `/api/v1/arqos/proposals`, `/api/v1/arqos/execute` |
| 7   | **Domain APIs**                                                     | Catalog, Orders, Customers, SEO/sitemap, Analytics — each existing feature area gets a clean API boundary instead of components calling Supabase directly                                                                                                                    | `/api/v1/catalog/*`, `/api/v1/orders/*`, etc.                              |
| 8+  | SEO/AEO/GEO, Performance, Monitoring, Testing, Documentation passes | Applied _within_ each domain module above as it's built, per your "audit → test → benchmark → optimize → document" rule — not a separate late-stage pass                                                                                                                     | —                                                                          |

## 3. Why this order (dependency chain)

- **API Gateway must come before Global Auth**, because auth is one of the
  things the gateway enforces — building auth first without a gateway means
  redoing the wiring later.
- **Global Auth must come before Shared AI Memory and Plugin System**,
  because both need to know _who_ is asking (a customer? the CHRO agent
  itself? an admin?) before deciding what memory/plugin access to grant.
- **ARQ Master OS core comes after** Memory + Plugins exist, because the OS's
  entire job is _orchestrating_ those two things — it has nothing to
  orchestrate until they're there.
- **Domain APIs (catalog/orders/etc.) can be migrated incrementally**,
  module by module, behind the gateway — this is the safest way to satisfy
  "never remove existing features" since each domain keeps working on direct
  Supabase calls until _its own_ migration module is approved and shipped.

## 4. What does NOT change

- The Supabase database, RLS policies, and existing edge functions keep
  working exactly as they do today throughout this whole process. The
  gateway is a new layer _in front of_ them, not a replacement — nothing
  currently working breaks mid-migration.
- The customer-facing storefront's data flow is untouched until its specific
  domain-API module is reached; there's no "big bang" cutover.

## 5. Requested next step

Confirm:

1. Which assumption from Section 0 is correct (A / B / C).
2. Approve **Module 2: API Gateway** to start, since everything else in this
   plan depends on it existing first.

Once approved, Module 2 will ship with the same discipline as Modules 1/1b:
implemented → tested → audited → benchmarked → documented, then I stop and
wait for your go-ahead before Module 3.
