// AI Learning Engine — daily cron.
// Reads recent ad performance, agent decisions, support chats, and orders;
// asks Gemini to distill actionable LONG-TERM insights;
// upserts them via the unified upsert_agent_learning() RPC into
// public.agent_learning_logs (the shared cross-agent learning memory).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import { AGENT_CORE_IDENTITY, loadAgentMemoryContext } from "../_shared/agent-identity.ts";
import { geminiGenerateJson, isGeminiConfiguredDb } from "../_shared/gemini.ts";
import { verifyCronSecret } from "../_shared/cron-secret.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Scope used inside the unified agent_learning_logs table for this engine's
// insights. Keys are namespaced with this prefix so future runs upsert cleanly.
const LEARNING_SCOPE = "learning_engine";
const learningKey = (category: string, insightKey: string) => `learning:${category}:${insightKey}`;

type Insight = {
  category:
    | "ad_performance"
    | "creative_winners"
    | "support_patterns"
    | "product_insights"
    | "scaling";
  insight_key: string;
  insight: string;
  evidence?: Record<string, unknown>;
  confidence?: number;
  impact_score?: number;
};

async function gatherTrainingData() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    adLogs,
    decisions,
    orders,
    supportMsgs,
    telegramHistory,
    prevLearning,
    stockSync,
    tickets,
    cjEvents,
  ] = await Promise.all([
    admin
      .from("ad_automation_logs")
      .select("platform, action, campaign_name, reason, metrics, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("agent_decisions")
      .select("decision_type, input_data, output_data, reasoning, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("orders")
      .select("id, total_amount, status, payment_status, shipping_country_name, created_at")
      .gte("created_at", since7d)
      .limit(500),
    admin
      .from("chat_messages")
      .select("content, role, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("telegram_chat_history")
      .select("role, content, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("agent_learning_logs")
      .select("category, key, value, importance, updated_at")
      .eq("scope", LEARNING_SCOPE)
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("stock_sync_logs")
      .select("supplier, status, products_synced, errors, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("support_tickets")
      .select("status, subject, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("cj_webhook_events")
      .select("event_type, status, payload, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Top items 7d
  const orderIds = (orders.data || []).map((o) => o.id);
  let topItems: Array<{ title: string; qty: number; revenue: number }> = [];
  if (orderIds.length) {
    const { data: items } = await admin
      .from("order_items")
      .select("title, quantity, unit_price")
      .in("order_id", orderIds);
    const agg: Record<string, { qty: number; revenue: number }> = {};
    for (const it of items || []) {
      const k = it.title;
      const q = Number(it.quantity || 0);
      const r = q * Number(it.unit_price || 0);
      agg[k] = { qty: (agg[k]?.qty || 0) + q, revenue: (agg[k]?.revenue || 0) + r };
    }
    topItems = Object.entries(agg)
      .map(([title, v]) => ({ title, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  return {
    window: "last_7d",
    ad_logs: adLogs.data || [],
    agent_decisions: decisions.data || [],
    orders_summary: {
      count: orders.data?.length || 0,
      revenue: (orders.data || []).reduce((s, o) => s + Number(o.total_amount || 0), 0),
    },
    top_items: topItems,
    support_messages: supportMsgs.data || [],
    telegram_history: telegramHistory.data || [],
    previous_insights: prevLearning.data || [],
    stock_sync_logs: stockSync.data || [],
    support_tickets: tickets.data || [],
    cj_webhook_events: cjEvents.data || [],
  };
}

type ActiveModel = { model: string; provider: "gemini" | "openai" | "anthropic" };

async function resolveActiveModel(): Promise<ActiveModel> {
  const { data } = await admin
    .from("agent_config")
    .select("value")
    .eq("key", "active_ai_model")
    .maybeSingle();
  const v = (data?.value as ActiveModel | undefined) || null;
  if (v?.model && v?.provider) return v;
  return { model: "gemini-2.5-flash", provider: "gemini" };
}

async function getProviderKey(provider: ActiveModel["provider"]): Promise<string | null> {
  const { data } = await admin
    .from("integration_secrets")
    .select("api_key")
    .eq("provider", provider)
    .maybeSingle();
  return data?.api_key || null;
}

async function callModel(active: ActiveModel, prompt: string): Promise<string | null> {
  if (active.provider === "openai") {
    const key = await getProviderKey("openai");
    if (key) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        console.error("[openai] error", r.status, await r.text());
        return null;
      }
      const j = await r.json();
      return j?.choices?.[0]?.message?.content || null;
    }
  }

  if (active.provider === "anthropic") {
    const key = await getProviderKey("anthropic");
    if (key) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt + "\n\nRespond with ONLY valid JSON." }],
        }),
      });
      if (!r.ok) {
        console.error("[anthropic] error", r.status, await r.text());
        return null;
      }
      const j = await r.json();
      return j?.content?.[0]?.text || null;
    }
  }

  if (!(await isGeminiConfiguredDb())) {
    console.error("[ai-learning-engine] Gemini API key not configured");
    return null;
  }
  try {
    const parsed = await geminiGenerateJson<unknown>({ prompt, surface: "learning" });
    return JSON.stringify(parsed);
  } catch (e) {
    console.error("[gemini] error", String(e));
    return null;
  }
}

async function distillInsights(data: unknown): Promise<Insight[]> {
  const active = await resolveActiveModel();
  const memory = await loadAgentMemoryContext(admin, { directiveLimit: 25, researchLimit: 12 });
  const prompt = `${AGENT_CORE_IDENTITY}

ROLE FOR THIS RUN: AUTONOMOUS LEARNING BRAIN for AR Prime Market (international dropshipping store). Synthesize the REAL operational data below into durable, store-specific rules.

🔒 STRICT DOMAIN FILTER (HARD):
- Every insight MUST belong to one of: ad_performance, creative_winners, support_patterns, product_insights, scaling.
- Every insight MUST reference real numbers from the operational data (orders, ad_logs, support_tickets, stock_sync_logs, cj_webhook_events, telegram_history) — never invent metrics.
- If the data is empty for a category, return FEWER insights — never fabricate a finding.
- ABSOLUTELY FORBIDDEN: insights about HR/hiring, general web-dev/frameworks, leadership philosophy, growth-hacking theory, productivity, IT security audits. If a topic does not directly move AR Prime Market USD revenue this week, DROP it.

== CEO DIRECTIVES (must align) ==
${JSON.stringify(memory.directives, null, 2)}

== RECENT SELF-RESEARCH (apply only if e-commerce-relevant) ==
${JSON.stringify(memory.research, null, 2)}

== REAL OPERATIONAL DATA (last 7 days, ground truth) ==
${JSON.stringify(data, null, 2)}

Return STRICT JSON ONLY (no markdown), shape:
{"insights":[{"category":"ad_performance|creative_winners|support_patterns|product_insights|scaling",
"insight_key":"short_stable_slug","insight":"1-2 sentence durable rule citing real numbers","evidence":{"source_table":"...","sample":"..."},
"confidence":0.0-1.0,"impact_score":estimated_usd_weekly_impact}]}

Rules:
- 0 to 8 insights (zero is acceptable if data is too thin — DO NOT pad).
- insight_key is a slug reused across days so the same rule upserts in place.
- Each insight must be ACTIONABLE — a concrete rule the ad-monitor, product-recommender, or support agent can apply immediately.
- Skip generic platitudes. No "best practices" tips. No HR/web-dev/growth-hack theory.`;

  const content = await callModel(active, prompt);
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.insights) ? (parsed.insights as Insight[]) : [];
  } catch (e) {
    console.error("[ai-learning-engine] parse fail", e);
    return [];
  }
}

async function upsertInsights(insights: Insight[]) {
  const valid = insights.filter((i) => i?.insight_key && i?.insight && i?.category);
  if (!valid.length) return 0;

  let written = 0;
  for (const ins of valid) {
    const conf = Math.min(1, Math.max(0, Number(ins.confidence ?? 0.6)));
    const importance = Math.max(1, Math.min(10, Math.round(conf * 10)));
    const sourceRef = JSON.stringify({
      confidence: conf,
      impact_score: Number(ins.impact_score ?? 0),
      evidence: ins.evidence ?? {},
    });
    const { error } = await admin.rpc("upsert_agent_learning", {
      p_scope: LEARNING_SCOPE,
      p_category: ins.category,
      p_key: learningKey(ins.category, ins.insight_key),
      p_value: ins.insight,
      p_importance: importance,
      p_source_agent: "ai-learning-engine",
      p_source_ref: sourceRef,
      p_tags: ["learning", ins.category],
      p_lock: false,
    });
    if (error) {
      console.error("[ai-learning-engine] upsert_agent_learning failed", error.message);
      continue;
    }
    written += 1;
  }
  return written;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sec = req.headers.get("x-cron-secret") || "";
    if (!(await verifyCronSecret(sec, admin))) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const data = await gatherTrainingData();
    const insights = await distillInsights(data);
    const written = await upsertInsights(insights);

    if (written > 0) {
      const top = insights
        .slice(0, 5)
        .map((i, idx) => `${idx + 1}. <b>${escapeHtml(i.category)}</b> — ${escapeHtml(i.insight)}`);
      await sendTelegramMessage(
        [
          `🧠 <b>AI Learning Cycle Complete</b>`,
          `Stored <b>${written}</b> durable insights for autonomous use.`,
          "",
          ...top,
        ].join("\n"),
      );
    }

    return new Response(JSON.stringify({ ok: true, written, insights }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-learning-engine]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: cors });
  }
});
