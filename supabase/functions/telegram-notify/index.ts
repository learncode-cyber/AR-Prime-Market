// Edge Function: telegram-notify
// Called by Supabase DB triggers (pg_net) when:
//  - a new row is inserted into public.orders
//  - a new row is inserted into public.abandoned_carts
// Authenticates via x-cron-secret header (CRON_SECRET).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const PUBLIC_SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://arprimemarket.shop";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtMoney(v: unknown, currency = "USD") {
  const n = Number(v);
  if (!isFinite(n)) return `${v} ${currency}`;
  return `${currency} ${n.toFixed(2)}`;
}

async function notifyNewOrder(record: Record<string, unknown>) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const orderId = String(record.id || "");
  // Pull order items for product summary
  let itemsLine = "";
  if (orderId) {
    const { data: items } = await admin
      .from("order_items")
      .select("title, quantity, unit_price")
      .eq("order_id", orderId)
      .limit(10);
    if (items && items.length) {
      itemsLine = items.map((it) => `• ${escapeHtml(it.title)} ×${it.quantity}`).join("\n");
    }
  }

  const country =
    record.shipping_country_name || record.shipping_country || record.customer_country_code || "—";
  const city = record.shipping_city || "—";
  const customer = record.customer_name || record.guest_email || record.customer_email || "Guest";
  const phone = record.customer_phone || "—";
  const total = fmtMoney(record.total_amount, String(record.currency || "USD"));
  const orderNo = record.order_number || orderId.slice(0, 8);
  const payment = record.payment_method || "—";

  const text =
    `🛒 <b>New Order!</b>\n\n` +
    `📋 <b>${escapeHtml(orderNo)}</b>\n` +
    `💰 Total: <b>${escapeHtml(total)}</b>\n` +
    `💳 Payment: ${escapeHtml(payment)}\n` +
    `👤 ${escapeHtml(customer)}\n` +
    `📞 ${escapeHtml(phone)}\n` +
    `🌍 ${escapeHtml(city)}, ${escapeHtml(country)}\n` +
    (itemsLine ? `\n<b>Items:</b>\n${itemsLine}\n` : "") +
    `\n🔗 <a href="${PUBLIC_SITE}/kali_master/orders/${orderId}">Manage in Admin</a>`;

  return sendTelegramMessage(text);
}

async function notifyAbandonedCart(record: Record<string, unknown>) {
  const cart = (record.cart as Record<string, unknown>) || {};
  const items = (cart.items as Array<Record<string, unknown>>) || [];
  const subtotal = fmtMoney(cart.subtotal, String(cart.currency || "USD"));
  const email = (cart.email as string) || "Anonymous visitor";
  const sessionId = (cart.session_id as string) || "";
  const itemsLine = items
    .slice(0, 5)
    .map((it) => `• ${escapeHtml(it.title || it.name || "Item")} ×${it.quantity || 1}`)
    .join("\n");
  const recoveryLink = `${PUBLIC_SITE}/cart?recover=${encodeURIComponent(sessionId || String(record.id || ""))}`;

  const text =
    `🛍️ <b>Abandoned Cart</b>\n\n` +
    `💵 Value: <b>${escapeHtml(subtotal)}</b>\n` +
    `✉️ ${escapeHtml(email)}\n` +
    (itemsLine ? `\n${itemsLine}\n` : "") +
    `\n🔗 <a href="${recoveryLink}">Recovery Link</a>`;

  return sendTelegramMessage(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth: shared cron secret (set by DB trigger pg_net call)
    const got = req.headers.get("x-cron-secret") || "";
    if (!CRON_SECRET || got !== CRON_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    // Supabase DB webhook payload shape:
    // { type, table, schema, record, old_record }
    // Our pg_net trigger sends { table, record }
    const table = body.table || "";
    const record = body.record || body.new || {};

    let result;
    if (table === "orders") {
      result = await notifyNewOrder(record);
    } else if (table === "abandoned_carts") {
      result = await notifyAbandonedCart(record);
    } else if (body.text) {
      // Allow ad-hoc messages for daily reports etc.
      result = await sendTelegramMessage(String(body.text), { parseMode: body.parse_mode });
    } else {
      return json({ error: "unsupported_table", table }, 400);
    }

    return json({ success: true, result });
  } catch (e) {
    console.error("[telegram-notify] error", e);
    return json({ error: String(e) }, 500);
  }
});
