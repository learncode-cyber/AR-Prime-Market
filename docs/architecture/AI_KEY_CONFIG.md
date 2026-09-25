# AI Key Admin-Panel Configuration (Module 15)

**Status:** Complete on both runtimes. Node side fully test-verified; Deno
side syntax-verified only (no Deno runtime in this sandbox) — see
"Important limitation" below.

## What was asked

"AI Gateway" (the Gemini AI connection) should be simplified so pasting an
API key directly into the admin panel makes every AI feature work — no
env vars, no redeploy. The API Gateway module itself (Module 2 — auth/
rate-limiting middleware) was explicitly NOT to be touched.

## What was found

Gemini API keys were env-var-only everywhere, on both runtimes:
- Node side (`src/lib/gemini.server.ts`) — used by `api/chat.ts`,
  `api/shopping-agent.ts`, `blog-ai.server.ts`, `product-ai.functions.ts`,
  `agent-chat.functions.ts`, `landing-copy.functions.ts`,
  `competitor-spy.functions.ts`.
- Deno side (`supabase/functions/_shared/gemini.ts` +
  `_shared/llm-client.ts`) — used by `chro-orchestrator` (via
  `llm-client.ts`, which is how the Security and Dev sub-agents actually
  run — see Module 6), `telegram-webhook`, `translate-content`,
  `ai-support-chat`, `daily-ceo-report`, `ai-learning-engine`,
  `agent-research-loop`.

Meanwhile, the admin panel already has a working, general-purpose
credential-management system: the API Keys page
(`kali_master.api-keys.tsx`) backed by the `api_credentials` table
(`provider`, `label`, `credentials` JSONB, `is_active`) — already used for
SteadFast, CJ Dropshipping, and AliExpress. Gemini just wasn't in that
list. This module wires Gemini into the existing system rather than
inventing a new one.

## What was built

### Node side (`src/lib/gemini.server.ts`) — fully tested

New key-resolution priority:
1. `<SURFACE>_GEMINI_KEY` env var (advanced ops override — unchanged)
2. `api_credentials` table, `provider = 'gemini'` (new — set via Admin
   Panel -> API Keys -> "Google Gemini AI")
3. Master `GEMINI_API_KEY` env var (fallback, for existing deployments)

Cached in-memory for 60 seconds (this is a single Hostinger Node process
per the confirmed hosting constraint, so no Redis needed for this). 7 call
sites updated to `await` the now-async `isGeminiConfigured`/`geminiProvider`.

Added "Google Gemini AI" to `BUILTIN_PROVIDERS` in `src/lib/integrations.ts`
(shows up in the admin API Keys page), plus a real connection-test handler
in the `test-credentials` edge function (pings the actual Gemini API with
the saved key, same pattern as the CJ/AliExpress/SteadFast tests).

### Deno side (`supabase/functions/_shared/gemini.ts` + `llm-client.ts`) — syntax-verified only

Added new `resolveGeminiKeyDb` / `isGeminiConfiguredDb` functions with the
identical priority order, reading from the same `api_credentials` table
via a fresh admin client created from `Deno.env` (`SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`, standard for edge functions).

Deliberately kept the old sync `resolveGeminiKey`/`isGeminiConfigured`
functions unchanged rather than modifying them in place — every existing
caller keeps working exactly as before if something about the new async
path has an issue this sandbox couldn't catch. New callers were pointed at
the new `*Db` functions one at a time:

- `gemini.ts`'s own 4 internal generation functions (`geminiGenerate`,
  `geminiGenerateJson`, `geminiChatWithTools`, `geminiGenerateImage`) — the
  actual API-calling functions — now resolve the key via the DB-aware
  path. Since these were already `async` and already awaited by every
  caller, this required zero changes to any external caller — it's an
  invisible upgrade for `chro-orchestrator`, sub-agents, and everything
  else that generates text/JSON/images via Gemini.
- `llm-client.ts`'s `pickProvider`, `llmGenerateJson`, `llmChatWithTools`,
  `llmStatus` — made async, now check the DB-aware Gemini status when
  deciding whether to route a task to Claude vs Gemini (this is the exact
  function `chro-orchestrator` uses to run the Security ("sec") and Dev
  ("dev") sub-agents).
- 6 direct callers of the old sync `isGeminiConfigured()` updated to
  `await isGeminiConfiguredDb()`: `translate-content`, `ai-support-chat`,
  `daily-ceo-report`, `ai-learning-engine`, `agent-research-loop` (2
  usages), and `telegram-webhook`'s `llmStatus()` call.

## Important limitation — please read before deploying

This sandbox has no Deno runtime. Every Deno-side change here was
verified by:
1. Reading each call site's surrounding code to confirm it's inside an
   `async function` before adding `await` (done for all 8 files, each
   checked individually).
2. Running the TypeScript compiler in permissive standalone mode
   (`tsc --noEmit --allowImportingTsExtensions`, ignoring the expected
   "cannot find module"/"cannot find name Deno" noise from checking a
   Deno file outside a Deno project) against each modified file — zero
   real syntax errors on any of the 8 files.
3. Brace/paren balance sanity checks on every touched file.

What this does NOT guarantee: runtime behavior once actually deployed to
Supabase (network calls to the dynamically-imported
`@supabase/supabase-js` via `esm.sh` inside `gemini.ts`'s
`fetchGeminiKeyFromAdminPanel`, actual RLS behavior on `api_credentials`
from a service-role client, etc.). Recommend testing this for real after
deploying: set a Gemini key via Admin Panel -> API Keys, then trigger one
CHRO-routed task to the Security or Dev sub-agent and confirm a proposal
appears in the ARQ Master OS queue (`/kali_master/arq-os`, Module 6).

## Testing performed

- Node side: 9 new unit tests on `resolveGeminiKey`'s priority order,
  DB-error fallback, caching, and `isGeminiConfigured`. `npx tsc --noEmit`
  -> 0 errors. `npm run test` -> 132/132 passed, 18/18 files (up from
  123/17 -- the 9 new tests plus 2 Module 5 tests updated for the new
  async plugin interface).
- Deno side: syntax-verified only, as described above -- no automated
  test suite exists for Supabase Edge Functions in this repo (consistent
  with the codebase's pre-existing state; not something this module
  introduced or was expected to add).
- `npx eslint --fix` scoped to touched Node files -- 0 new errors (a
  handful of pre-existing `any` usages on untouched lines, same documented
  debt as Modules 11/14).

## Next step

1. Recommend a live smoke test after deploying, per the limitation above.
2. Same admin-panel treatment could be extended to `ANTHROPIC_API_KEY`
   (currently still env-var-only on the Deno side) if wanted -- not done
   here since it wasn't explicitly requested and would mean adding another
   `BUILTIN_PROVIDERS` entry plus a parallel fix in `llm-client.ts`'s
   `hasAnthropic()`.
3. Still pending from the same conversation: removing Lovable branding/
   footprint (including favicon), and a broader "is every automation
   actually working" pass.
