import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { geminiProvider, isGeminiConfigured } from "@/lib/gemini.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AGENT_CORE_IDENTITY } from "@/lib/agent-identity";

const HistoryMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const InputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(HistoryMsg).max(40).default([]),
});

const ActionType = z.enum([
  "create_ad_campaign",
  "pause_campaign",
  "import_researched_product",
  "update_product_price",
  "create_coupon",
  "send_email_blast",
  "flash_sale",
  "low_stock_report",
  "sales_report",
  "roas_report",
  "research_products",
]);

const OutputSchema = z.object({
  reply: z.string().min(1).max(4000),
  action: z
    .object({
      type: ActionType,
      label: z.string().min(1).max(120),
      reasoning: z.string().min(1).max(800),
      payload: z.record(z.string(), z.any()).default({}),
    })
    .nullable(),
});

const SYSTEM_PROMPT = `${AGENT_CORE_IDENTITY}

OPERATIONAL RULES (Ask AI / admin chat surface):
- সব উত্তর বাংলায় (technical term ইংরেজি OK)। সংক্ষিপ্ত, executive tone।
- International dropshipping — USA/CA/UK/EU/AU/UAE, USD pricing।
- Write-action (ad তৈরি, product import, price update, coupon, email, pause, flash sale) propose করতে হলে action JSON দাও — কখনো নিজে execute করার দাবি করবে না।
- শুধু রিপোর্ট/তথ্যমূলক প্রশ্নে action = null, reply-এ data দাও।
- প্রতিটি action-এ Zero-Loss filter অনুযায়ী payload-এ যেখানে প্রযোজ্য expected_roas, cpa_cap_usd, kill_rule, validation_signals যোগ করো।

Action types এবং expected payload:
- create_ad_campaign: { name, platform: "facebook"|"google"|"tiktok", daily_budget (USD), objective, target_audience, expected_roas, cpa_cap_usd, kill_rule, validation_signals[] }
- pause_campaign: { campaign_name বা campaign_id, reason }
- import_researched_product: { title, supplier_price, suggested_price, category, validation_signals[] }
- update_product_price: { product_title বা product_id, new_price_usd, reason }
- create_coupon: { code, discount_type: "percentage"|"fixed", discount_value, min_order_amount, expires_at }
- send_email_blast: { subject, segment, preview_text }
- flash_sale: { product_titles[], discount_percent, duration_hours }
- low_stock_report / sales_report / roas_report / research_products: payload optional`;

export const chatWithAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    if (!(await isGeminiConfigured("agent_chat"))) throw new Error("Gemini API key not configured");
    const model = await geminiProvider(undefined, "agent_chat");

    const transcript = data.history
      .map((m) => `${m.role === "user" ? "Admin" : "Agent"}: ${m.content}`)
      .join("\n");

    const prompt = `${transcript ? `Conversation so far:\n${transcript}\n\n` : ""}Admin: ${data.message}\n\nতোমার উত্তর JSON schema অনুযায়ী দাও।`;

    const { experimental_output } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      experimental_output: Output.object({ schema: OutputSchema }),
    });

    return experimental_output;
  });
