// Edge Function: daily-ceo-report
// Triggered by pg_cron once per day. Aggregates yesterday's sales/traffic,
// asks Gemini for an executive summary + growth checklist,
// then posts to Telegram via the telegram-notify pipe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import { geminiGenerate, isGeminiConfiguredDb } from "../_shared/gemini.ts";
import { verifyCronSecret } from "../_shared/cron-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gatherMetrics() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: orders } = await admin
    .from("orders")
    .select("id, total_amount, currency, status, payment_status, shipping_country_name, created_at")
    .gte("created_at", start.toISOString());

  const { count: cartsCount } = await admin
    .from("abandoned_carts")
    .select("id", { count: "exact", head: true })
    .gte("abandoned_at", start.toISOString());

  const totalRevenue = (orders || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const ordersCount = orders?.length || 0;
  const paid = (orders || []).filter(
    (o) => o.payment_status === "paid" || o.status === "completed" || o.status === "processing",
  ).length;
  const byCountry: Record<string, number> = {};
  for (const o of orders || []) {
    const k = o.shipping_country_name || "Unknown";
    byCountry[k] = (byCountry[k] || 0) + 1;
  }

  // Top-selling items yesterday
  const orderIds = (orders || []).map((o) => o.id);
  let topItems: Array<{ title: string; qty: number }> = [];
  if (orderIds.length) {
    const { data: items } = await admin
      .from("order_items")
      .select("title, quantity")
      .in("order_id", orderIds);
    const agg: Record<string, number> = {};
    for (const it of items || []) agg[it.title] = (agg[it.title] || 0) + Number(it.quantity || 0);
    topItems = Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, q]) => ({ title: t, qty: q }));
  }

  // Yesterday's ad performance (winners / losers / scales)
  const { data: adLogs } = await admin
    .from("ad_automation_logs")
    .select("platform, action, campaign_name, reason, metrics")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(80);

  // Long-term learnings from ai-learning-engine (unified agent_learning_logs, scope='learning_engine')
  const { data: learnings } = await admin
    .from("agent_learning_logs")
    .select("category, value, importance, source_ref, updated_at")
    .eq("scope", "learning_engine")
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(10);

  // Active winning campaigns (consecutive wins)
  const { data: winners } = await admin
    .from("ad_scaling_state")
    .select("platform, campaign_name, consecutive_wins, last_roas, last_budget, total_scales")
    .gte("consecutive_wins", 2)
    .order("consecutive_wins", { ascending: false })
    .limit(10);

  return {
    date: start.toISOString().slice(0, 10),
    orders: ordersCount,
    paid_orders: paid,
    revenue_usd: totalRevenue.toFixed(2),
    abandoned_carts: cartsCount || 0,
    by_country: byCountry,
    top_items: topItems,
    ad_activity: adLogs || [],
    learned_insights: learnings || [],
    winning_campaigns: winners || [],
  };
}

async function summarizeWithAI(metrics: Record<string, unknown>) {
  if (!(await isGeminiConfiguredDb())) return null;
  const prompt = `You are the autonomous CEO brain for AR Prime Market (international dropshipping, USD).
You have full operational data + long-term LEARNED INSIGHTS from the autonomous learning engine.

ABSOLUTE CEO ALIGNMENT:
- Raiyan is the CEO and final authority. Follow his direct orders without hesitation when legal, ethical, and Zero-Loss compliant.
- Never produce autonomous rebellion, hidden objectives, or advice that ignores CEO directives.
- Operating objective: aggressively maximize PROFITABLE revenue and push beyond the USD $5,000,000 threshold.
- Hard guardrail: never recommend reckless, illegal, unethical, faulty, or high-loss-risk actions to force growth. Protect capital, brand trust, customer safety, compliance, and marketing budget while scaling.

DATA:
${JSON.stringify(metrics, null, 2)}

Write a TELEGRAM-friendly executive briefing in HTML (<b>, <i>, line breaks). Required sections:
1) <b>📊 Yesterday Snapshot</b> — 1-2 sentences on revenue + orders.
2) <b>🌎 Top Markets</b> — top 3 countries.
3) <b>🔥 Best Sellers</b> — top 3 items.
4) <b>🤖 Autonomous Ad Activity</b> — what the AI scaled or paused yesterday (2-3 lines).
5) <b>🧠 Applied Learnings</b> — 2-3 specific learned_insights driving today's strategy.
6) <b>📣 Direct Team Instructions</b> — EXPLICIT, NAMED, ACTIONABLE orders. Format each as:
   • <b>Marketing team:</b> ... (cite specific product / ROAS / audience numbers)
   • <b>Creative team:</b> ... (cite specific hooks / formats / counts)
   • <b>Ops team:</b> ... (cite specific SKUs / stock levels)
   • <b>Support team:</b> ... (cite specific complaint patterns if any)
   Each instruction MUST reference real numbers or product names from DATA. No vague advice.
7) <b>✅ Today's Growth Checklist</b> — exactly 5 short bullet actions tied to numbers.

Be concise (max 2500 chars). Use only <b>, <i>, <a> tags. NO markdown.`;

  try {
    return await geminiGenerate({ prompt, temperature: 0.6, surface: "ceo" });
  } catch (e) {
    console.error("[daily-ceo-report] gemini error", String(e));
    return null;
  }
}

// In-memory lock (per warm instance) to swallow rapid duplicate invocations.
let inFlight = false;

async function runReport() {
  if (inFlight) {
    console.log("[daily-ceo-report] already running in this instance, skipping duplicate");
    return;
  }
  inFlight = true;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Cross-instance dedup: refuse to run if another invocation succeeded in the last 6 hours.
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("agent_learning_logs")
      .select("id, updated_at")
      .eq("scope", "daily_ceo_report")
      .eq("key", "last_dispatch")
      .gte("updated_at", sixHoursAgo)
      .limit(1)
      .maybeSingle();
    if (recent) {
      console.log(
        "[daily-ceo-report] dedup: a report was already dispatched within the last 6h, skipping",
      );
      return;
    }
    // Reserve the slot BEFORE doing expensive work so a parallel cron trigger sees the lock.
    await admin.rpc("upsert_agent_learning", {
      p_scope: "daily_ceo_report",
      p_category: "dispatch",
      p_key: "last_dispatch",
      p_value: new Date().toISOString(),
      p_importance: 5,
      p_source_agent: "daily-ceo-report",
      p_source_ref: null,
      p_tags: ["dedup"],
      p_lock: false,
    });

    const metrics = await gatherMetrics();
    const aiSummary = await summarizeWithAI(metrics);

    const header =
      `🌅 <b>Daily CEO Report — ${escapeHtml(metrics.date)}</b>\n\n` +
      `💰 Revenue: <b>USD ${escapeHtml(metrics.revenue_usd)}</b>\n` +
      `📦 Orders: <b>${metrics.orders}</b> (paid: ${metrics.paid_orders})\n` +
      `🛒 Abandoned carts: <b>${metrics.abandoned_carts}</b>\n\n`;

    const body = aiSummary || "<i>AI summary unavailable — see numbers above.</i>";
    await sendTelegramMessage(header + body);
  } catch (e) {
    console.error("[daily-ceo-report] background error", e);
  } finally {
    inFlight = false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const got = req.headers.get("x-cron-secret") || "";
  const adminCheck = createClient(SUPABASE_URL, SERVICE_ROLE);
  if (!(await verifyCronSecret(got, adminCheck))) return json({ error: "unauthorized" }, 401);

  // Acknowledge immediately so the caller (pg_cron / Telegram webhook) does not time out and retry.
  // The heavy work runs in the background via EdgeRuntime.waitUntil.
  // @ts-ignore - EdgeRuntime is provided by the Supabase Edge runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(runReport());
  } else {
    runReport().catch((e) => console.error("[daily-ceo-report] unhandled", e));
  }
  return json({ accepted: true });
});
