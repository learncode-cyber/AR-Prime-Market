/**
 * Shared AI Memory (Module 4) — Node/TanStack Start side.
 *
 * WHY THIS EXISTS: a real "shared memory" system already existed in this
 * codebase — `agent_learning_logs` + `ceo_directives` + `agent_research_logs`,
 * queried in one round trip via the `get_agent_memory_context()` RPC — but
 * it was only wired up on the Deno edge-function side
 * (`supabase/functions/_shared/agent-identity.ts`, used by the CHRO
 * orchestrator, telegram bot, and learning engine). Supabase Edge Functions
 * (Deno) and this Node/TanStack Start app are two separate runtimes with no
 * shared import graph, so customer-facing AI surfaces running in Node —
 * `api/chat.ts` ("Raiyan AI"), `api/shopping-agent.ts` — had zero access to
 * it. Each agent was building its own context independently, exactly the
 * gap the original brief's "Shared AI Memory" item describes.
 *
 * This module is the Node-side twin: same RPC, same underlying tables, so
 * every agent — regardless of which runtime it executes in — reads from
 * one shared source of truth. It deliberately does NOT duplicate the
 * `upsert_agent_learning` write path in this module; see
 * docs/architecture/SHARED_AI_MEMORY.md for why writes stay narrower in
 * scope for this module.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AgentDirective {
  topic: string;
  directive: string;
  importance: number;
  tags: string[];
  created_at: string;
}

export interface AgentResearch {
  category: string;
  title: string;
  summary: string;
  key_takeaways: unknown;
  created_at: string;
}

export interface AgentLearning {
  scope: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  tags: string[];
  is_locked: boolean;
  updated_at: string;
}

export interface AgentMemoryContext {
  directives: AgentDirective[];
  research: AgentResearch[];
  learning: AgentLearning[];
}

const EMPTY_CONTEXT: AgentMemoryContext = { directives: [], research: [], learning: [] };

export interface LoadMemoryOptions {
  directiveLimit?: number;
  researchLimit?: number;
  learningLimit?: number;
  scope?: string | null;
}

/**
 * Loads the shared memory context. No client-side caching here (unlike the
 * Deno twin's 60s micro-cache) — the Node process is longer-lived than a
 * single edge-function invocation, so an in-memory cache here would risk
 * serving stale locked-learning data to customers for much longer. Callers
 * needing to avoid a DB round trip per request should cache at the call
 * site with an explicit, short TTL appropriate to their traffic.
 */
export async function loadSharedAgentMemory(
  options: LoadMemoryOptions = {},
): Promise<AgentMemoryContext> {
  const { data, error } = await supabaseAdmin.rpc("get_agent_memory_context", {
    p_directive_limit: options.directiveLimit ?? 20,
    p_research_limit: options.researchLimit ?? 10,
    p_learning_limit: options.learningLimit ?? 30,
    p_scope: options.scope ?? null,
  });
  if (error || !data) return EMPTY_CONTEXT;
  const raw = data as Partial<AgentMemoryContext>;
  return {
    directives: raw.directives ?? [],
    research: raw.research ?? [],
    learning: raw.learning ?? [],
  };
}

/**
 * Renders the shared, locked cross-agent learnings (business goals, target
 * markets, persona/tone rules, supply chain facts) as a compact block
 * suitable for appending to ANY agent's system prompt — customer-facing or
 * internal. Deliberately does NOT include CEO directives or research logs
 * (those are internal-operations content, not appropriate to leak into a
 * customer-facing assistant's context) — use
 * `supabase/functions/_shared/agent-identity.ts`'s
 * `buildSystemPromptWithMemory` for the full internal-agent version.
 */
export function buildSharedLearningBlock(ctx: AgentMemoryContext): string {
  if (ctx.learning.length === 0) return "";
  const lines = ctx.learning
    .filter((l) => l.is_locked) // only permanent, vetted facts — never provisional/low-confidence entries
    .slice(0, 20)
    .map((l) => `- [${l.category}] ${l.value}`)
    .join("\n");
  if (!lines) return "";
  return `\n\n== SHARED COMPANY CONTEXT (same source of truth used by all AR Prime Market AI agents) ==\n${lines}`;
}
