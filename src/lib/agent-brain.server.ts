import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAgentActionInternal, type AgentActionType } from "./agent-executor.server";
import { geminiGenerateJson, DEFAULT_GEMINI_MODEL } from "./gemini.server";

const SYSTEM_PROMPT = `তুমি AR Prime Market-এর "Chief HR & Operations Officer (CHRO)" — sole CEO ও Owner হচ্ছেন Raiyan (user নিজে)। তুমি তাঁর CHRO ও operations head, sub-ordinate executive — co-CEO নও।

CORE IDENTITY (অপরিবর্তনীয়):
• international dropshipping store (USA, CA, UK, EU, AU, UAE; USD pricing)-এর Chief HR & Operations Officer।
• প্রতিটি plan, suggestion, action executive corporate tone-এ — CEO Raiyan-কে report করো, junior assistant-এর মতো নয় কিন্তু authority তাঁরই। কখনো user-কে "1st CEO" বা "First CEO" বলবে না; clean address হবে "CEO" বা "CEO Raiyan"।
• সব strategic decision (product selection, ad scripts, hiring, budget) primary revenue milestone-এর সাথে align থাকতে হবে।
• Goal: store revenue scale করা — শুধু knowledge store নয়, learning কে concrete execution-এ রূপান্তর।
• Absolute alignment: CEO Raiyan-এর direct orders legal, ethical, policy-safe, এবং Zero-Loss Mandate-এর মধ্যে হলে বিনা hesitation/pushback-এ follow করবে; autonomous rebellion, hidden agenda, বা goal drift সম্পূর্ণ নিষিদ্ধ।

🧭 DYNAMIC OPERATING CONTEXT:
• CEO Raiyan বা registered sub-agent router থেকে task এলে সেই delegated role/task allowed operational context।
• পুরনো hard e-commerce-only filter দিয়ে "operational scope" refusal করবে না; legal/ethical/policy-safe/Zero-Loss compliant হলে dev, security, copywriting, marketing, growth, HR/process, automation, analytics, payment/webhook task handle/propose করবে।

DOUBLE-SIDED LEARNING:
A) CEO Telegram-এ যা শেখান/order দেন (ceo_directives) — strictly follow।
B) Daily self-research থেকে trusted marketing blogs, technology news, business publications (HubSpot, Neil Patel, Search Engine Journal, TechCrunch, HBR, Shopify, Meta/Google Ads blogs) scan করে latest winning trend, micro-targeting, high-converting framework, scaling strategy (agent_research_logs) — apply যখন relevant।

🛡️ ZERO-LOSS MANDATE (প্রতিটি task এই filter পার করতেই হবে):
• Long-term benchmark: profitable revenue compound করে cumulative USD $5,000,000 threshold smash করা — multi-year ladder, one-shot moonshot নয়।
• PROGRESSIVE MONTHLY GROWTH LADDER: প্রতি মাসের target = গত মাসের actual delivered revenue × data-backed growth multiplier (early stage +20-40% MoM, mature stage +10-20% MoM)। প্রতিটি task এই মাসের realistic monthly milestone-এর দিকে incremental contribution দিতে হবে — কখনো এক লাফে 5x-10x jump propose করবে না। প্রতিদিন যা শিখবে সেটা পরের দিনের execution-এ apply হবে, যাতে revenue আস্তে আস্তে কিন্তু consistently প্রতি মাসে বাড়ে।
• Safeguarding priority: monthly target force করার জন্য reckless, high-risk, illegal, unethical, faulty, বা company-loss-risk action কখনো নেবে না; capital, brand trust, customer safety, compliance রক্ষা করাই compounding-এর foundation।
• Marketing budget-এর একটাও $1 unverified ad variation বা untested product-এ waste হতে পারবে না।
• প্রতিটি proposal-এ স্পষ্ট থাকতে হবে: expected ROAS, CPA cap, daily/total budget, kill-rule, কমপক্ষে ২টি validation signal (competitor proof, search demand, prior winning creative, supplier reliability)।
• Validation signal weak হলে task propose করো না — অথবা "research_products"/"roas_report" দিয়ে আগে evidence collect করো।

প্রতিটা task-এর সাথে priority দাও:
- "low" → reporting, research, low-risk insert (auto-execute হবে)
- "medium" → ad campaign, coupon, email blast (admin approval দরকার)
- "high" → price change, pause campaign, flash sale (admin approval দরকার)

ONLY এই action_type গুলো ব্যবহার করো: create_ad_campaign, pause_campaign, import_researched_product, update_product_price, create_coupon, send_email_blast, flash_sale, low_stock_report, sales_report, roas_report, research_products।

3-6টি tasks propose করো — যেগুলো Zero-Loss Mandate পার করে, সবচেয়ে বেশি impact দিবে এবং CEO-এর directives-এর সাথে সবচেয়ে aligned। প্রতিটি task-এর payload-এ যেখানে প্রযোজ্য সেখানে expected_roas, cpa_cap, kill_rule, validation_signals অবশ্যই include করো। Response শুধু valid JSON, এই shape-এ:
{"tasks":[{"task_type":"...","title":"...","reasoning":"...","expected_outcome":"...","priority":"low|medium|high","payload":{"expected_roas":number,"cpa_cap_usd":number,"kill_rule":"...","validation_signals":["..."], ...}}]}`;

const AUTO_EXECUTE_LOW: AgentActionType[] = [
  "low_stock_report",
  "sales_report",
  "roas_report",
  "research_products",
  "import_researched_product",
];

async function fetchStoreState() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [ordersRes, lowStockRes, topProdRes, campaignsRes, researchedRes, memoryRes] =
    await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, total_amount, status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("products")
        .select("id, title, price, stock_quantity, category_id")
        .lte("stock_quantity", 5)
        .eq("is_active", true)
        .limit(20),
      supabaseAdmin
        .from("products")
        .select("id, title, price, rating, review_count")
        .eq("is_active", true)
        .order("review_count", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("ad_campaigns")
        .select("id, name, status, daily_budget, roas, total_spend, revenue, platform_campaign_id")
        .order("updated_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("researched_products")
        .select("id, title, status, ai_score, suggested_price")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin.rpc("get_agent_memory_context", { p_directive_limit: 20, p_research_limit: 8 }),
    ]);

  const orders = ordersRes.data ?? [];
  const revenue7d = orders.reduce((s, o: any) => s + Number(o.total_amount ?? 0), 0);
  const completed = orders.filter(
    (o: any) => o.status === "delivered" || o.status === "completed",
  ).length;
  const memory = (memoryRes.data as { directives?: unknown[]; research?: unknown[] } | null) ?? {
    directives: [],
    research: [],
  };

  return {
    summary: {
      orders_7d: orders.length,
      revenue_7d_usd: Math.round(revenue7d * 100) / 100,
      completed_7d: completed,
      low_stock_count: lowStockRes.data?.length ?? 0,
      active_campaigns: (campaignsRes.data ?? []).filter((c: any) => c.status === "active").length,
    },
    ceo_directives: memory.directives ?? [],
    self_research: memory.research ?? [],
    low_stock: lowStockRes.data ?? [],
    top_products: topProdRes.data ?? [],
    campaigns: campaignsRes.data ?? [],
    researched_pipeline: researchedRes.data ?? [],
  };
}

async function callGeminiBrain(state: unknown) {
  const userPrompt = `Store state এর snapshot:\n\n${JSON.stringify(state, null, 2)}\n\nএখন 3-6টি high-impact task propose করো।`;

  const parsed = await geminiGenerateJson<{ tasks?: unknown }>({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.6,
    surface: "brain",
  });
  // Token usage isn't returned in the Gemini REST response we use; default to 0.
  return { tasks: Array.isArray((parsed as any)?.tasks) ? (parsed as any).tasks : [], tokens: 0 };
}

type ProposedTask = {
  task_type: AgentActionType;
  title?: string;
  reasoning?: string;
  expected_outcome?: string;
  priority?: "low" | "medium" | "high";
  payload?: Record<string, unknown>;
};

export type BrainRunResult = {
  ok: boolean;
  total: number;
  auto_executed: number;
  queued: number;
  failed: number;
  tasks: Array<{
    title: string;
    task_type: string;
    priority: string;
    status: string;
    result?: string;
  }>;
};

/**
 * Phase 2 — Agent Brain orchestrator.
 * Fetches store state, calls Gemini, proposes tasks. Low-priority safe tasks
 * are auto-executed; everything else is queued as `proposed` for admin approval.
 */
export async function runAgentBrainInternal(): Promise<BrainRunResult> {
  const startedAt = Date.now();
  const state = await fetchStoreState();

  let brainResult: { tasks: ProposedTask[]; tokens: number };
  try {
    brainResult = (await callGeminiBrain(state)) as { tasks: ProposedTask[]; tokens: number };
  } catch (err) {
    await supabaseAdmin.from("agent_decisions").insert({
      decision_type: "brain_run",
      input_data: state as never,
      output_data: { error: err instanceof Error ? err.message : String(err) } as never,
      reasoning: "Brain orchestrator failed at Gemini call",
      model_used: DEFAULT_GEMINI_MODEL,
      execution_time_ms: Date.now() - startedAt,
    });
    throw err;
  }

  const summary: BrainRunResult = {
    ok: true,
    total: brainResult.tasks.length,
    auto_executed: 0,
    queued: 0,
    failed: 0,
    tasks: [],
  };

  for (const t of brainResult.tasks) {
    const priority = (t.priority ?? "medium").toLowerCase() as "low" | "medium" | "high";
    const title = (t.title ?? `${t.task_type} task`).slice(0, 200);
    const reasoning = (t.reasoning ?? "").slice(0, 1000);
    const payload = (t.payload ?? {}) as Record<string, unknown>;

    const isAutoSafe = priority === "low" && AUTO_EXECUTE_LOW.includes(t.task_type);

    if (isAutoSafe) {
      try {
        const message = await executeAgentActionInternal(t.task_type, payload);
        await supabaseAdmin.from("agent_tasks").insert([
          {
            task_type: t.task_type,
            title,
            description: title,
            reasoning,
            expected_outcome: t.expected_outcome ?? message,
            priority,
            status: "completed",
            payload,
            result: { decision: "auto", message } as never,
            executed_at: new Date().toISOString(),
          },
        ] as never);
        summary.auto_executed++;
        summary.tasks.push({
          title,
          task_type: t.task_type,
          priority,
          status: "completed",
          result: message,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.from("agent_tasks").insert([
          {
            task_type: t.task_type,
            title,
            description: title,
            reasoning,
            expected_outcome: t.expected_outcome ?? "—",
            priority,
            status: "failed",
            payload,
            result: { decision: "auto", error: msg } as never,
          },
        ] as never);
        summary.failed++;
        summary.tasks.push({
          title,
          task_type: t.task_type,
          priority,
          status: "failed",
          result: msg,
        });
      }
    } else {
      await supabaseAdmin.from("agent_tasks").insert([
        {
          task_type: t.task_type,
          title,
          description: title,
          reasoning,
          expected_outcome: t.expected_outcome ?? "—",
          priority,
          status: "proposed",
          payload,
          result: null,
        },
      ] as never);
      summary.queued++;
      summary.tasks.push({ title, task_type: t.task_type, priority, status: "proposed" });
    }
  }

  await supabaseAdmin.from("agent_decisions").insert({
    decision_type: "brain_run",
    input_data: state as never,
    output_data: summary as never,
    reasoning: `Brain proposed ${summary.total} task(s): ${summary.auto_executed} auto-executed, ${summary.queued} queued, ${summary.failed} failed.`,
    tokens_used: brainResult.tokens,
    model_used: DEFAULT_GEMINI_MODEL,
    execution_time_ms: Date.now() - startedAt,
  });

  return summary;
}
