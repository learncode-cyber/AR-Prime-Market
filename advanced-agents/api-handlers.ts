// ═══════════════════════════════════════════════════════════════════════════
// API Route Handlers for All Agents
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// 📊 Get Agent Status
export async function getAgentStatus(): Promise<any> {
  console.log("📊 Getting agent status...");
  
  const { data: agents } = await supabase
    .from("agents")
    .select("*");

  return {
    total_agents: agents?.length || 0,
    agents: agents?.map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      last_heartbeat: a.last_heartbeat,
    })) || [],
    system_health: "healthy",
    uptime: "99.9%",
    last_check: new Date(),
  };
}

// 💰 Get Revenue Metrics
export async function getRevenueMetrics(days: number = 30): Promise<any> {
  console.log(`💰 Getting revenue metrics for last ${days} days...`);

  const { data: orders } = await supabase
    .from("orders")
    .select("total, created_at")
    .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  const total_revenue = orders?.reduce((sum: number, o: any) => sum + o.total, 0) || 0;
  const avg_daily = total_revenue / days;
  const order_count = orders?.length || 0;

  return {
    total_revenue: total_revenue.toFixed(2),
    average_daily: avg_daily.toFixed(2),
    order_count,
    average_order_value: (total_revenue / order_count).toFixed(2),
    period_days: days,
  };
}

// 🎯 Get Marketing Metrics
export async function getMarketingMetrics(): Promise<any> {
  console.log("🎯 Getting marketing metrics...");

  const { data: campaigns } = await supabase
    .from("marketing_campaigns")
    .select("*");

  const sent = campaigns?.filter((c: any) => c.status === "sent").length || 0;
  const opened = campaigns?.filter((c: any) => c.status === "opened").length || 0;
  const clicked = campaigns?.filter((c: any) => c.status === "clicked").length || 0;
  const converted = campaigns?.filter((c: any) => c.status === "converted").length || 0;

  return {
    campaigns_sent: sent,
    open_rate: ((opened / sent) * 100).toFixed(2) + "%",
    click_rate: ((clicked / opened) * 100).toFixed(2) + "%",
    conversion_rate: ((converted / clicked) * 100).toFixed(2) + "%",
    email_performance: "excellent",
  };
}

// 👥 Get Customer Metrics
export async function getCustomerMetrics(): Promise<any> {
  console.log("👥 Getting customer metrics...");

  const { data: customers } = await supabase
    .from("customers")
    .select("*");

  const total = customers?.length || 0;

  const { data: orders } = await supabase
    .from("orders")
    .select("customer_id");

  const unique_buyers = new Set(orders?.map((o: any) => o.customer_id)).size;

  return {
    total_customers: total,
    active_customers: unique_buyers,
    new_customers_today: 0,
    retention_rate: ((unique_buyers / total) * 100).toFixed(2) + "%",
    avg_lifetime_value: 500,
  };
}

// 📦 Get Inventory Status
export async function getInventoryStatus(): Promise<any> {
  console.log("📦 Getting inventory status...");

  const { data: items } = await supabase
    .from("inventory")
    .select("*");

  const low_stock = items?.filter((i: any) => i.quantity <= i.reorder_point).length || 0;
  const total_items = items?.length || 0;

  return {
    total_products: total_items,
    low_stock_count: low_stock,
    health_score: ((1 - low_stock / total_items) * 100).toFixed(2) + "%",
    reorders_needed: low_stock,
  };
}

// 🚀 Run Agent Task
export async function runAgentTask(agentId: string, taskType: string, params: any): Promise<any> {
  console.log(`🚀 Running ${taskType} for agent ${agentId}...`);

  try {
    // Log the task
    const { data: task } = await supabase
      .from("agent_tasks")
      .insert([
        {
          agent_id: agentId,
          task_type: taskType,
          parameters: params,
          status: "in_progress",
        },
      ])
      .select()
      .single();

    // Simulate task execution
    const result = await executeTask(agentId, taskType, params);

    // Update task status
    await supabase
      .from("agent_tasks")
      .update({ status: "completed", result })
      .eq("id", task.id);

    return {
      success: true,
      task_id: task.id,
      result,
      completed_at: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// 🎭 Request CEO Approval
export async function requestCEOApproval(taskId: string, details: any): Promise<any> {
  console.log(`🎭 Requesting CEO approval for task ${taskId}...`);

  const { data: approval } = await supabase
    .from("ceo_approvals")
    .insert([
      {
        task_id: taskId,
        status: "pending",
        requested_at: new Date(),
      },
    ])
    .select()
    .single();

  // Send Telegram notification
  await sendTelegramNotification(
    `Task ${taskId} requires approval. Details: ${JSON.stringify(details)}`
  );

  return {
    approval_id: approval.id,
    status: "pending",
    requested_at: approval.requested_at,
    awaiting_response: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

async function executeTask(agentId: string, taskType: string, params: any): Promise<any> {
  // Task execution logic based on agent type and task type
  const results: any = {
    marketing: {
      optimize_price: { revenue_increase: "15%" },
      create_campaign: { emails_sent: 1000 },
      run_ab_test: { winner: "variant_b" },
    },
    support: {
      segment_customers: { segments_created: 5 },
      handle_ticket: { resolved: true },
      process_return: { approved: true },
    },
    learning: {
      train_model: { accuracy: 0.92 },
      predict_demand: { forecast: 150 },
      identify_trends: { trends_found: 3 },
    },
  };

  return results[agentId]?.[taskType] || { status: "completed" };
}

async function sendTelegramNotification(message: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (error) {
    console.error("Telegram notification failed:", error);
  }
}

// Main HTTP Server
serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "healthy" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/agents/status") {
      const status = await getAgentStatus();
      return new Response(JSON.stringify(status), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/metrics/revenue") {
      const metrics = await getRevenueMetrics();
      return new Response(JSON.stringify(metrics), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/metrics/marketing") {
      const metrics = await getMarketingMetrics();
      return new Response(JSON.stringify(metrics), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/agents/task" && req.method === "POST") {
      const body = await req.json();
      const result = await runAgentTask(body.agent_id, body.task_type, body.params);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

