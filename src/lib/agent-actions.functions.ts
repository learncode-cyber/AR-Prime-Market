import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAgentActionInternal, type AgentActionType } from "./agent-executor.server";

const ActionType = z.enum([
  "create_ad_campaign",
  "pause_campaign",
  "import_researched_product",
  "update_product_price",
  "create_coupon",
  "send_email_blast",
  "send_marketing_email",
  "send_push_notification",
  "schedule_task",
  "flash_sale",
  "low_stock_report",
  "sales_report",
  "roas_report",
  "research_products",
]);

const InputSchema = z.object({
  action_type: ActionType,
  label: z.string().min(1).max(200),
  reasoning: z.string().min(1).max(1000),
  payload: z.record(z.string(), z.unknown()).default({}),
  decision: z.enum(["confirm", "deny"]),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin role required");
}

export const executeAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.decision === "deny") {
      await supabaseAdmin.from("agent_tasks").insert([
        {
          task_type: data.action_type,
          title: data.label,
          description: data.label,
          reasoning: data.reasoning,
          expected_outcome: "—",
          priority: "low",
          status: "rejected",
          payload: data.payload,
          result: { decision: "deny" },
        },
      ] as never);
      return { ok: true, result_message: "Action বাতিল করা হয়েছে।" };
    }

    let resultMessage: string;
    let status: "completed" | "failed" = "completed";
    let resultPayload: Record<string, unknown>;
    try {
      resultMessage = await executeAgentActionInternal(
        data.action_type as AgentActionType,
        data.payload,
      );
      resultPayload = { decision: "confirm", message: resultMessage };
    } catch (err) {
      status = "failed";
      resultMessage = err instanceof Error ? err.message : "Unknown error";
      resultPayload = { decision: "confirm", error: resultMessage };
    }

    await supabaseAdmin.from("agent_tasks").insert([
      {
        task_type: data.action_type,
        title: data.label,
        description: data.label,
        reasoning: data.reasoning,
        expected_outcome: resultMessage,
        priority: "medium",
        status,
        payload: data.payload,
        result: resultPayload,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
      },
    ] as never);

    return { ok: status === "completed", result_message: resultMessage };
  });

export const listAgentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("agent_tasks")
      .select("id, task_type, title, status, result, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });
