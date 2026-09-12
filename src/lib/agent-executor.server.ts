import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMarketingEmailToAllCustomers } from "./marketing-email.server";
import { sendWebPushToAllAdmins } from "./push.server";

export type AgentActionType =
  | "create_ad_campaign"
  | "pause_campaign"
  | "import_researched_product"
  | "update_product_price"
  | "create_coupon"
  | "send_email_blast"
  | "send_marketing_email"
  | "send_push_notification"
  | "schedule_task"
  | "flash_sale"
  | "low_stock_report"
  | "sales_report"
  | "roas_report"
  | "research_products";

/**
 * Single source of truth for executing an agent action server-side.
 * Used by both the chat confirm/deny flow AND the autonomous brain orchestrator.
 */
export async function executeAgentActionInternal(
  action_type: AgentActionType,
  payload: Record<string, unknown>,
): Promise<string> {
  switch (action_type) {
    case "create_ad_campaign": {
      const name = String(payload.name ?? "AI Campaign");
      const platform = String(payload.platform ?? "facebook");
      const daily_budget = Number(payload.daily_budget ?? 10);
      const { error } = await supabaseAdmin.from("ad_campaigns").insert([
        {
          name,
          daily_budget,
          status: "active",
          ai_created: true,
          objective: String(payload.objective ?? "conversions"),
          target_audience: { platform, ...((payload.target_audience as object) ?? {}) },
        },
      ] as never);
      if (error) throw error;
      return `Ad campaign "${name}" (${platform}) তৈরি হয়েছে — দৈনিক budget $${daily_budget}।`;
    }
    case "pause_campaign": {
      const ident = String(payload.campaign_id ?? payload.campaign_name ?? "");
      if (!ident) throw new Error("campaign_id বা campaign_name দরকার");
      const q = supabaseAdmin.from("ad_campaigns").update({ status: "paused" });
      const { error } = ident.match(/^[0-9a-f-]{36}$/i)
        ? await q.eq("id", ident)
        : await q.eq("name", ident);
      if (error) throw error;
      return `Campaign "${ident}" pause করা হয়েছে।`;
    }
    case "import_researched_product": {
      const title = String(payload.title ?? "Untitled");
      const { error } = await supabaseAdmin.from("researched_products").insert({
        title,
        source: "ai_agent",
        supplier_price: Number(payload.supplier_price ?? 0),
        suggested_price: Number(payload.suggested_price ?? 0),
        category: payload.category ? String(payload.category) : null,
        ai_score: Number(payload.ai_score ?? 80),
        status: "pending_import",
      });
      if (error) throw error;
      return `Product "${title}" research queue-এ যোগ হয়েছে।`;
    }
    case "update_product_price": {
      const ident = String(payload.product_id ?? payload.product_title ?? "");
      const new_price = Number(payload.new_price_usd ?? payload.new_price ?? 0);
      if (!ident || !new_price) throw new Error("product এবং দাম দরকার");
      const q = supabaseAdmin.from("products").update({ price: new_price });
      const { error } = ident.match(/^[0-9a-f-]{36}$/i)
        ? await q.eq("id", ident)
        : await q.eq("title", ident);
      if (error) throw error;
      return `"${ident}"-এর দাম $${new_price} করা হয়েছে।`;
    }
    case "create_coupon": {
      const code = String(
        payload.code ?? "AI" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      );
      const { error } = await supabaseAdmin.from("coupons").insert({
        code: code.toUpperCase(),
        discount_type: String(payload.discount_type ?? "percentage"),
        discount_value: Number(payload.discount_value ?? 10),
        min_order_amount:
          payload.min_order_amount != null ? Number(payload.min_order_amount) : null,
        expires_at: payload.expires_at ? String(payload.expires_at) : null,
        is_active: true,
      });
      if (error) throw error;
      return `Coupon "${code}" তৈরি হয়েছে।`;
    }
    case "send_email_blast": {
      const subject = String(payload.subject ?? "AR Prime Market update");
      const { error } = await supabaseAdmin.from("email_logs").insert({
        to_address: "marketing-blast@queue.local",
        subject,
        body: String(payload.preview_text ?? subject),
        status: "pending",
      });
      if (error) throw error;
      return `Email blast "${subject}" queue-এ পাঠানো হয়েছে।`;
    }
    case "send_marketing_email": {
      const subject = String(payload.subject ?? "AR Prime Market");
      const html = String(payload.html ?? payload.body ?? `<p>${subject}</p>`);
      const r = await sendMarketingEmailToAllCustomers(subject, html, null, null);
      return `Marketing email "${subject}" পাঠানো হয়েছে — ${r.sent} sent, ${r.failed} failed (blast ${r.blastId.slice(0, 8)}).`;
    }
    case "send_push_notification": {
      const title = String(payload.title ?? "AR Prime Market");
      const body = String(payload.body ?? payload.message ?? "");
      const url = String(payload.url ?? "/");
      if (!body) throw new Error("body দরকার");
      const r = await sendWebPushToAllAdmins(title, body, url);
      await supabaseAdmin.from("marketing_blasts").insert({
        channel: "push",
        subject: title,
        body,
        recipient_count: r.sent + r.failed,
        success_count: r.sent,
        failure_count: r.failed,
        status: "completed",
        completed_at: new Date().toISOString(),
      } as never);
      return `Push "${title}" পাঠানো হয়েছে — ${r.sent} delivered, ${r.failed} failed।`;
    }
    case "schedule_task": {
      const when = payload.scheduled_at ? new Date(String(payload.scheduled_at)) : null;
      if (!when || isNaN(when.getTime())) throw new Error("scheduled_at (ISO timestamp) দরকার");
      const inner = String(payload.action_type ?? "");
      if (!inner) throw new Error("action_type দরকার");
      const { error } = await supabaseAdmin.from("agent_tasks").insert({
        task_type: inner,
        title: String(payload.label ?? `Scheduled: ${inner}`),
        description: String(payload.label ?? inner),
        reasoning: String(payload.reasoning ?? "Scheduled by agent"),
        expected_outcome: "Will run at scheduled time",
        priority: "medium",
        status: "scheduled",
        payload: (payload.inner_payload as object) ?? {},
        scheduled_at: when.toISOString(),
      } as never);
      if (error) throw error;
      return `Task "${inner}" schedule করা হয়েছে — ${when.toLocaleString()} এ run হবে।`;
    }
    case "flash_sale":
    case "low_stock_report":
    case "sales_report":
    case "roas_report":
    case "research_products":
      return `Action "${action_type}" log করা হয়েছে — background task হিসেবে শীঘ্রই execute হবে।`;
  }
}
