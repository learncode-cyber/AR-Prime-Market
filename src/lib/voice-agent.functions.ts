import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("has_role", { p_user: userId, p_role: "admin" });
  if (!ok) throw new Error("Forbidden: admin role required");
}

export const getVoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("voice_agent_settings")
      .select("id, enabled, delay_seconds, script_template, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: data };
  });

export const updateVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean().optional(),
        delay_seconds: z.number().int().min(0).max(3600).optional(),
        script_template: z.string().min(10).max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await supabaseAdmin
      .from("voice_agent_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Settings row missing");
    const { error } = await supabaseAdmin
      .from("voice_agent_settings")
      .update(data)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVoiceCallLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("voice_call_logs")
      .select(
        "id, order_id, phone, customer_name, script, provider, status, dtmf_digit, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { logs: data ?? [] };
  });

export const listVoiceQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("voice_call_queue")
      .select("id, order_id, scheduled_at, status, attempts, last_error, created_at")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { queue: data ?? [] };
  });

// Admin-triggered manual simulation of a customer DTMF keypress
export const simulateKeypress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ call_log_id: z.string().uuid(), digit: z.enum(["1", "2"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: log } = await supabaseAdmin
      .from("voice_call_logs")
      .select("id, order_id, status")
      .eq("id", data.call_log_id)
      .maybeSingle();
    if (!log) throw new Error("Call log not found");

    const newStatus = data.digit === "1" ? "confirmed" : "cancelled";
    await supabaseAdmin
      .from("voice_call_logs")
      .update({ status: newStatus, dtmf_digit: data.digit })
      .eq("id", log.id);

    if (data.digit === "1") {
      await supabaseAdmin.from("orders").update({ status: "confirmed" }).eq("id", log.order_id);
    } else {
      await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", log.order_id);
      await supabaseAdmin.from("agent_notifications").insert({
        type: "voice_agent",
        title: "Order cancelled via voice agent",
        message: `Customer pressed 2. Order ${log.order_id} cancelled.`,
      });
    }
    return { ok: true, status: newStatus };
  });
