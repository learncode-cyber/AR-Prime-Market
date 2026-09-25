// Supabase Edge Function: send-email
// Processes pending rows in public.email_logs and sends via Resend.
// Trigger modes:
//   - POST {} -> drains all pending rows (cron / batch use)
//   - POST { order_id } -> processes only logs matching that order's number (post-checkout)
// Reads RESEND_API_KEY + optional from_email from public.integration_secrets (provider='resend').
// Falls back to RESEND_API_KEY / RESEND_FROM env vars.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailLog {
  id: string;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  status: string | null;
  retry_count: number | null;
  max_retries: number | null;
}

function backoffMinutes(attempt: number): number {
  // 1m, 5m, 15m, 60m, ...
  const schedule = [1, 5, 15, 60, 240];
  return schedule[Math.min(attempt, schedule.length - 1)];
}

async function markFailure(
  supabase: ReturnType<typeof createClient>,
  log: EmailLog,
  errorMsg: string,
) {
  const attempts = (log.retry_count ?? 0) + 1;
  const max = log.max_retries ?? 3;
  if (attempts >= max) {
    await supabase
      .from("email_logs")
      .update({
        status: "failed",
        retry_count: attempts,
        last_error: errorMsg.slice(0, 500),
        next_retry_at: null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", log.id);
    return "failed";
  }
  const next = new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString();
  await supabase
    .from("email_logs")
    .update({
      status: "pending",
      retry_count: attempts,
      last_error: errorMsg.slice(0, 500),
      next_retry_at: next,
    })
    .eq("id", log.id);
  return "retry_scheduled";
}

interface OrderItem {
  title: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_method: string;
  estimated_delivery: string | null;
  shipping_address: string | null;
  guest_token: string | null;
}

const SITE_NAME = "AR Prime Market";
const SITE_URL = "https://arprimemarket.shop";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

function renderOrderConfirmation(order: OrderRow, items: OrderItem[]): string {
  const trackUrl = `${SITE_URL}/order-confirmation/${order.id}${order.guest_token ? `?token=${order.guest_token}` : ""}`;
  const eta = order.estimated_delivery
    ? new Date(order.estimated_delivery).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "5 business days";
  const itemsHtml = items
    .map(
      (it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">
        <div style="font-size:14px;color:#111;font-weight:600;">${escapeHtml(it.title)}</div>
        <div style="font-size:12px;color:#666;">Qty: ${it.quantity}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#111;">
        ${(it.unit_price * it.quantity).toFixed(2)} ${escapeHtml(order.currency)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#e91e63;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;">${SITE_NAME}</h1>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h2 style="margin:0 0 8px;color:#111;font-size:20px;">Order Confirmed 🎉</h2>
          <p style="margin:0 0 4px;color:#555;font-size:14px;">Thank you for your order!</p>
          <p style="margin:0 0 20px;color:#111;font-size:14px;"><strong>Order #:</strong> ${escapeHtml(order.order_number)}</p>
          <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}
            <tr><td style="padding:14px 0 0;font-size:14px;color:#111;"><strong>Total</strong></td>
              <td style="padding:14px 0 0;text-align:right;font-size:16px;color:#e91e63;"><strong>${Number(order.total_amount).toFixed(2)} ${escapeHtml(order.currency)}</strong></td></tr>
            <tr><td colspan="2" style="padding:12px 0;color:#555;font-size:13px;">Payment: ${escapeHtml(order.payment_method)}</td></tr>
            <tr><td colspan="2" style="padding:0 0 16px;color:#555;font-size:13px;">Estimated delivery: <strong>${escapeHtml(eta)}</strong></td></tr>
          </table>
          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${trackUrl}" style="background:#e91e63;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">Track Order</a>
          </div>
          <p style="margin:24px 0 0;color:#888;font-size:12px;text-align:center;">If the button doesn't work: ${trackUrl}</p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px;text-align:center;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${SITE_NAME}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function renderStatusUpdate(order: OrderRow, statusText: string): string {
  const trackUrl = `${SITE_URL}/order-confirmation/${order.id}${order.guest_token ? `?token=${order.guest_token}` : ""}`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;max-width:600px;width:100%;">
      <tr><td style="background:#e91e63;padding:24px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">${SITE_NAME}</h1></td></tr>
      <tr><td style="padding:28px 24px;">
        <h2 style="margin:0 0 12px;color:#111;font-size:20px;">${escapeHtml(statusText)}</h2>
        <p style="margin:0 0 8px;color:#555;font-size:14px;">Your order <strong>${escapeHtml(order.order_number)}</strong> status has been updated to <strong>${escapeHtml(order.status)}</strong>.</p>
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${trackUrl}" style="background:#e91e63;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">View Order</a>
        </div>
      </td></tr>
      <tr><td style="background:#fafafa;padding:16px;text-align:center;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${SITE_NAME}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function statusHeading(status: string): string | null {
  const s = status.toLowerCase();
  if (s.includes("ship")) return "Your order has shipped! 📦";
  if (s.includes("deliver")) return "Your order was delivered ✅";
  if (s.includes("cancel")) return "Your order was cancelled";
  if (s.includes("process")) return "Your order is being processed";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: CRON_SECRET header OR admin JWT
    const provided = req.headers.get("x-cron-secret") || "";
    const envSecret = Deno.env.get("CRON_SECRET") || "";
    let authorized = !!(provided && envSecret && provided === envSecret);
    if (!authorized) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const ANON_KEY =
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await userClient.auth.getUser();
        if (u?.user) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            p_user: u.user.id,
            p_role: "admin",
          });
          if (isAdmin) authorized = true;
        }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Resend credentials
    let resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    let fromEmail = Deno.env.get("RESEND_FROM") ?? "";
    const { data: secret } = await supabase
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "resend")
      .maybeSingle();
    if (secret?.api_key) resendKey = secret.api_key;
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("extra_config")
      .eq("provider", "resend")
      .maybeSingle();
    const cfg = (settings?.extra_config as { from_email?: string } | null) ?? null;
    if (cfg?.from_email) fromEmail = cfg.from_email;
    if (!fromEmail) fromEmail = `${SITE_NAME} <onboarding@resend.dev>`;

    if (!resendKey) {
      return new Response(
        JSON.stringify({
          error:
            "RESEND_API_KEY not configured. Insert into public.integration_secrets (provider='resend') or set RESEND_API_KEY env var.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse body
    let body: { order_id?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      /* empty body ok */
    }

    // Determine which pending logs to process
    let logs: EmailLog[] = [];
    if (body.order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", body.order_id)
        .maybeSingle();
      if (ord?.order_number) {
        const { data } = await supabase
          .from("email_logs")
          .select("*")
          .eq("status", "pending")
          .ilike("subject", `%${ord.order_number}%`)
          .limit(10);
        logs = (data ?? []) as EmailLog[];
      }
    } else {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("email_logs")
        .select("*")
        .eq("status", "pending")
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .limit(body.limit ?? 50);
      logs = (data ?? []) as EmailLog[];
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const log of logs) {
      if (!log.to_address || !log.subject) {
        await supabase
          .from("email_logs")
          .update({
            status: "failed",
            last_error: "missing recipient/subject",
            next_retry_at: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", log.id);
        results.push({ id: log.id, status: "failed", error: "missing recipient/subject" });
        continue;
      }

      // Resolve template
      let html = `<pre style="font-family:Arial,sans-serif;font-size:14px;color:#111;">${escapeHtml(log.body ?? "")}</pre>`;
      let text = log.body ?? "";

      const orderNumberMatch = log.subject.match(/ORD-[A-Z0-9-]+/i);
      if (orderNumberMatch) {
        const { data: order } = await supabase
          .from("orders")
          .select(
            "id, order_number, total_amount, currency, status, payment_method, estimated_delivery, shipping_address, guest_token",
          )
          .eq("order_number", orderNumberMatch[0])
          .maybeSingle();
        if (order) {
          const subjLower = log.subject.toLowerCase();
          if (subjLower.includes("confirmation") || subjLower.includes("received")) {
            const { data: items } = await supabase
              .from("order_items")
              .select("title, quantity, unit_price, image_url")
              .eq("order_id", order.id);
            html = renderOrderConfirmation(order as OrderRow, (items ?? []) as OrderItem[]);
            text = `Order ${order.order_number} confirmed. Total: ${order.total_amount} ${order.currency}. Track: ${SITE_URL}/order-confirmation/${order.id}`;
          } else {
            const heading = statusHeading(order.status) ?? `Order ${order.status}`;
            html = renderStatusUpdate(order as OrderRow, heading);
            text = `${heading} — ${order.order_number}. View: ${SITE_URL}/order-confirmation/${order.id}`;
          }
        }
      }

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: [log.to_address],
            subject: log.subject,
            html,
            text,
          }),
        });
        if (!resp.ok) {
          const errTxt = await resp.text();
          const outcome = await markFailure(supabase, log, `${resp.status}: ${errTxt}`);
          results.push({
            id: log.id,
            status: outcome,
            error: `${resp.status}: ${errTxt.slice(0, 200)}`,
          });
        } else {
          await supabase
            .from("email_logs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              last_error: null,
              next_retry_at: null,
            })
            .eq("id", log.id);
          results.push({ id: log.id, status: "sent" });
        }
      } catch (err) {
        const outcome = await markFailure(supabase, log, String(err));
        results.push({ id: log.id, status: outcome, error: String(err).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
