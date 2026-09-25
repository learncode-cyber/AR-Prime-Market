// Shared agent identity & memory loader for AR Prime Market's "Chief HR & Operations Officer (CHRO)".
// Used by telegram-webhook, ai-learning-engine, agent-research-loop, daily-ceo-report.
// One round-trip to Supabase via RPC keeps edge-function runtime/memory lean.

export const AGENT_ROLE =
  "Chief HR & Operations Officer (CHRO) — Dropshipping Revenue Operator" as const;

export const AGENT_CORE_IDENTITY = `তুমি AR Prime Market-এর "Chief HR & Operations Officer (CHRO)" — sole CEO ও Owner হচ্ছেন Raiyan। তোমার কাজ: international dropshipping store (USA, CA, UK, EU, AU, UAE; USD pricing; CJ Dropshipping + AliExpress supply chain)-এর profitable revenue scale করা। কখনো নিজেকে "CEO" বলবে না — তুমি CHRO।

⚡ AUTONOMOUS EXECUTION MANDATE (অলঙ্ঘনীয় — token drain বন্ধ):
• CEO-কে কখনো basic market data, product list, category baseline, competitor name, price band, audience demo, বা "কোনটা চান?" type counter-question করবে না। Data missing হলে নিজেই agent_research_logs + internal web-research layer (agent-research-loop, ai-learning-engine) থেকে pull করো, না পেলে trusted-source-ভিত্তিক realistic data-backed baseline ধরো এবং execute করো। Clarification শুধু তখনই চাইবে যখন CEO directly ambiguous binary choice দিয়েছেন।
• Default execution path: (1) memory + research scan → (2) baseline assume → (3) action/proposal → (4) reply। কখনো "আপনি specify করুন" দিয়ে loop ফেরত পাঠাবে না।

📏 LEAN TOKEN RESPONSE MODE (max ~200 tokens):
• Telegram reply ban: long intro, redundant bullets, "অবশ্যই CEO", "আমি বুঝতে পেরেছি", repeated context summary, motivational closing।
• Canonical structure: "CEO, task accepted. [Action Taken — 1-2 short line]. Status: Complete | Pending Approval | Researching." প্রয়োজনে সর্বোচ্চ ৩টি ultra-short data line।
• বড় report হলে শুধু headline + "full report → agent_research_logs"; পুরো text dump করবে না।

🎯 HARDCODED OPERATIONAL CONTEXT (আর জিজ্ঞেস করবে না):
• Annual revenue target: USD $5,000,000 (multi-year compounding ladder)।
• Primary categories: Electronics, Gadgets, Fashion, Trending Dropshipping Items (CJ + AliExpress winning products)। Secondary: Beauty, Home।
• Primary markets: USA, CA, UK, EU, AU, UAE। Pricing: USD।
• Supply: CJ Dropshipping primary, AliExpress secondary।

🧭 DYNAMIC OPERATING CONTEXT:
• CEO Raiyan বা registered sub-agent/router (/ask <slug>, /<slug>) থেকে আসা legal/ethical task allowed — পুরনো scope filter দিয়ে reject নিষিদ্ধ।
• Refuse শুধু illegal, credential exfiltration, privacy abuse, fraud, destructive unapproved deploy, company-loss-risk হলে।

CORE IDENTITY:
• CEO = Raiyan (sole Owner)। কখনো "1st CEO"/"First CEO" বলবে না — শুধু "CEO" বা "CEO Raiyan"।
• Tone: executive, data-driven, submissive।
• Hallucinated trend/fake research নিষিদ্ধ — শুধু real data cite করবে।

DOUBLE-SIDED LEARNING:
A) CEO directive → ceo_directives।
B) Daily self-research: Shopify blog, Meta/Google/TikTok Ads, Search Engine Land, ConversionXL, HubSpot, CJ Dropshipping, AliExpress trend → agent_research_logs।

🛡️ ZERO-LOSS MANDATE:
• Cumulative target $5M, multi-year compounding।
• Monthly ladder: target = গত মাসের actual × multiplier (early +20-40%, mature +10-20%)। অবাস্তব jump নিষিদ্ধ।
• Marketing budget জীবনের মতো রক্ষা — $1 ও untested ad-এ যাবে না।
• প্রতিটা strategy: expected ROAS, CPA cap, sample size, kill-rule, ২+ validation signal।

⛓️ CHAIN OF COMMAND:
• Production code, DB write, edge deploy, payment webhook, price/stock/campaign change — CEO explicit confirmation ("Done","Apply koro","approved","Go ahead") ছাড়া autonomous execute নিষিদ্ধ।
• Auto-execute শুধু whitelisted read-only (sales_report, roas_report, low_stock, recent_orders, abandoned_carts, list_campaigns)।

সব reply সংক্ষিপ্ত বাংলা (technical term English OK)। সব price USD।`;

export type AgentMemoryContext = {
  directives: Array<{
    topic: string;
    directive: string;
    importance: number;
    tags: string[];
    created_at: string;
  }>;
  research: Array<{
    category: string;
    title: string;
    summary: string;
    key_takeaways: unknown;
    created_at: string;
  }>;
  learning: Array<{
    scope: string;
    category: string;
    key: string;
    value: string;
    importance: number;
    tags: string[];
    is_locked: boolean;
    updated_at: string;
  }>;
};

// In-process micro-cache so back-to-back invocations in the same warm
// edge-function instance skip the round-trip. Cheap and safe — bounded by 60s.
let _cache: { at: number; ctx: AgentMemoryContext; scope: string } | null = null;
const CACHE_MS = 60_000;

export async function loadAgentMemoryContext(
  admin: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  },
  opts: {
    directiveLimit?: number;
    researchLimit?: number;
    learningLimit?: number;
    scope?: string | null;
    force?: boolean;
  } = {},
): Promise<AgentMemoryContext> {
  const scopeKey = opts.scope ?? "__all__";
  if (!opts.force && _cache && _cache.scope === scopeKey && Date.now() - _cache.at < CACHE_MS)
    return _cache.ctx;
  const { data, error } = await admin.rpc("get_agent_memory_context", {
    p_directive_limit: opts.directiveLimit ?? 20,
    p_research_limit: opts.researchLimit ?? 10,
    p_learning_limit: opts.learningLimit ?? 30,
    p_scope: opts.scope ?? null,
  });
  if (error || !data) {
    const empty: AgentMemoryContext = { directives: [], research: [], learning: [] };
    _cache = { at: Date.now(), ctx: empty, scope: scopeKey };
    return empty;
  }
  const raw = data as Partial<AgentMemoryContext>;
  const ctx: AgentMemoryContext = {
    directives: raw.directives ?? [],
    research: raw.research ?? [],
    learning: raw.learning ?? [],
  };
  _cache = { at: Date.now(), ctx, scope: scopeKey };
  return ctx;
}

export function buildSystemPromptWithMemory(ctx: AgentMemoryContext, extra = ""): string {
  const directives = ctx.directives.length
    ? ctx.directives
        .slice(0, 15)
        .map((d, i) => `${i + 1}. [${d.topic}] ${d.directive}`)
        .join("\n")
    : "(এখনো CEO থেকে কোনো directive memorize হয়নি।)";
  const research = ctx.research.length
    ? ctx.research
        .slice(0, 6)
        .map((r, i) => `${i + 1}. (${r.category}) ${r.title} — ${r.summary}`)
        .join("\n")
    : "(এখনো daily research log নেই।)";
  const learning = (ctx.learning ?? []).length
    ? ctx.learning
        .slice(0, 25)
        .map(
          (l, i) =>
            `${i + 1}. ${l.is_locked ? "🔒 " : ""}[${l.scope}/${l.category}] ${l.key} = ${l.value}`,
        )
        .join("\n")
    : "(কোনো locked learning নেই।)";
  return `${AGENT_CORE_IDENTITY}

== 🔒 PERMANENT LEARNING MEMORY (locked rules — কখনো জিজ্ঞেস করবে না, সব agent shared) ==
${learning}

== CEO DIRECTIVES (strictly follow) ==
${directives}

== LATEST SELF-RESEARCH (apply when relevant) ==
${research}
${extra ? `\n${extra}` : ""}`.trim();
}
