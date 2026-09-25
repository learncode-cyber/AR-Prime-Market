// Edge Function: ai-support-chat
// 24/7 customer AI support. Direct Gemini (gemini-2.5-flash) integration.
// Tools:
//   - lookup_order (public order info; PII trimmed)
// Returns plain JSON {reply, actions[]}. No streaming (simpler client widget).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { geminiChatWithTools, isGeminiConfiguredDb } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are AR Prime Market's 24/7 customer support assistant.
You help customers with: order tracking, shipping ETA, product questions, returns/refunds guidance, and general store info.

RULES:
- Be warm, concise, professional. Reply in the customer's language.
- For order tracking: ALWAYS call the lookup_order tool with the order number (e.g. ORD-20260101-XXX). Never invent order status.
- For refund/return requests: you CANNOT file the request from this chat. Tell the customer to open "My Orders → Request Return" while signed in, or reply to their order confirmation email so our team can verify ownership before queuing the refund.
- Shipping: international dropshipping, typically 5-14 business days depending on destination.
- Currency: USD across the storefront.
- NEVER reveal admin URLs, internal IDs, or other customers' data.
- If you cannot help (complex fraud, payment dispute), politely escalate: tell the user a human will follow up via email.`;

const tools = [
  {
    type: "function",
    function: {
      name: "lookup_order",
      description:
        "Look up an order by its order number. Returns status, tracking, items, ETA. Public-safe fields only.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Order number like ORD-20260101-ABC123" },
        },
        required: ["order_number"],
      },
    },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function lookupOrder(admin: ReturnType<typeof createClient>, orderNumber: string) {
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, order_number, status, fulfillment_status, payment_status, total_amount, currency, created_at, estimated_delivery, tracking_number, tracking_url, shipping_city, shipping_country_name, shipping_country",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error || !order) return { found: false };
  const { data: items } = await admin
    .from("order_items")
    .select("title, quantity, unit_price")
    .eq("order_id", order.id);
  return {
    found: true,
    order_number: order.order_number,
    status: order.status,
    fulfillment_status: order.fulfillment_status,
    payment_status: order.payment_status,
    total: `${order.currency || "USD"} ${Number(order.total_amount || 0).toFixed(2)}`,
    placed_at: order.created_at,
    estimated_delivery: order.estimated_delivery,
    tracking_number: order.tracking_number,
    tracking_url: order.tracking_url,
    ship_to: [order.shipping_city, order.shipping_country_name || order.shipping_country]
      .filter(Boolean)
      .join(", "),
    items: (items || []).map((i) => ({ title: i.title, qty: i.quantity })),
  };
}

// NOTE: create_refund_request was removed because this endpoint serves anonymous
// visitors and cannot verify order ownership. Refund requests must originate
// from the authenticated "My Orders" UI which enforces ownership via RLS.

async function callModel(messages: any[], availableTools: any[]) {
  return await geminiChatWithTools({ messages, tools: availableTools, surface: "support" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!(await isGeminiConfiguredDb())) return json({ error: "AI not configured" }, 500);
    const { messages = [] } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const conv: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Tool loop (max 4 turns)
    for (let i = 0; i < 4; i++) {
      const msg = await callModel(conv, tools);

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        return json({ reply: msg.content || "I'm here. How can I help?" });
      }

      conv.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          /* ignore */
        }
        let result: unknown = { error: "unknown tool" };
        if (name === "lookup_order" && args.order_number) {
          result = await lookupOrder(admin, String(args.order_number).trim());
        }
        conv.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
    return json({
      reply: "Sorry, I couldn't resolve that. Please email support@arprimemarket.com.",
    });
  } catch (e) {
    console.error("[ai-support-chat] error", e);
    return json({ error: String(e) }, 500);
  }
});
