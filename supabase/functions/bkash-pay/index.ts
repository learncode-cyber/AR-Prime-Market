// Supabase Edge Function: bkash-pay
// Multi-action bKash sandbox payment gateway.
// Actions:
//   - action: "create"   -> grant token + create payment, return bkashURL
//   - action: "execute"  -> execute payment, mark order paid
//   - action: "callback" -> handle bKash redirect (GET) and forward to /payment/return
//   - action: "query"    -> query payment status by paymentID
//
// Credentials are read from integration_secrets (provider='bkash') with fallback
// to env vars: BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD,
// BKASH_BASE_URL (sandbox: https://tokenized.sandbox.bka.sh/v1.2.0-beta).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SITE_URL = Deno.env.get("SITE_URL") || "https://arprimemarket.shop";
const SANDBOX_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

interface BkashCreds {
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  base_url: string;
}

async function loadCreds(supabase: ReturnType<typeof createClient>): Promise<BkashCreds> {
  // Try integration_secrets first (extra_config as JSON)
  const { data: settings } = await supabase
    .from("integration_settings")
    .select("extra_config")
    .eq("provider", "bkash")
    .maybeSingle();
  const { data: secret } = await supabase
    .from("integration_secrets")
    .select("api_key")
    .eq("provider", "bkash")
    .maybeSingle();

  const cfg = (settings?.extra_config as any) || {};
  return {
    app_key: cfg.app_key || Deno.env.get("BKASH_APP_KEY") || "",
    app_secret:
      (secret?.api_key as string) || cfg.app_secret || Deno.env.get("BKASH_APP_SECRET") || "",
    username: cfg.username || Deno.env.get("BKASH_USERNAME") || "",
    password: cfg.password || Deno.env.get("BKASH_PASSWORD") || "",
    base_url: cfg.base_url || Deno.env.get("BKASH_BASE_URL") || SANDBOX_BASE,
  };
}

async function grantToken(creds: BkashCreds): Promise<string> {
  const res = await fetch(`${creds.base_url}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: creds.username,
      password: creds.password,
    },
    body: JSON.stringify({ app_key: creds.app_key, app_secret: creds.app_secret }),
  });
  const json = await res.json();
  if (!json.id_token)
    throw new Error(`bKash token grant failed: ${json.statusMessage || JSON.stringify(json)}`);
  return json.id_token as string;
}

async function bkashApi(creds: BkashCreds, token: string, path: string, body: unknown) {
  const res = await fetch(`${creds.base_url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": creds.app_key,
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Handle GET callback from bKash redirect
    if (req.method === "GET") {
      const paymentID = url.searchParams.get("paymentID");
      const status = url.searchParams.get("status");
      const orderId = url.searchParams.get("order_id");
      const token = url.searchParams.get("token");
      const params = new URLSearchParams();
      params.set("provider", "bkash");
      if (paymentID) params.set("paymentID", paymentID);
      if (status) params.set("status", status);
      if (orderId) params.set("order_id", orderId);
      if (token) params.set("token", token);
      return Response.redirect(`${SITE_URL}/payment/return?${params.toString()}`, 302);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    const creds = await loadCreds(supabase);

    if (!creds.app_key || !creds.app_secret || !creds.username || !creds.password) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "bKash credentials not configured. Add BKASH_APP_KEY/SECRET/USERNAME/PASSWORD as secrets or via Admin → Integrations.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- CREATE ----------
    if (action === "create") {
      const { order_id, guest_token } = body;
      if (!order_id) return jsonErr("order_id required");

      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, currency, guest_token, user_id")
        .eq("id", order_id)
        .maybeSingle();
      if (!order) return jsonErr("Order not found");

      // Ownership check
      const authHeader = req.headers.get("Authorization") || "";
      const tokenHdr = authHeader.replace(/^Bearer\s+/i, "");
      let callerUserId: string | null = null;
      if (tokenHdr) {
        const anon = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
          { global: { headers: { Authorization: `Bearer ${tokenHdr}` } } },
        );
        const { data: u } = await anon.auth.getUser();
        callerUserId = u?.user?.id ?? null;
      }
      const ownsByUser = !!callerUserId && order.user_id === callerUserId;
      const ownsByGuest = !!order.guest_token && !!guest_token && order.guest_token === guest_token;
      if (!ownsByUser && !ownsByGuest) return jsonErr("Forbidden", 403);

      const token = await grantToken(creds);
      const callbackParams = new URLSearchParams({
        order_id: order.id,
        ...(order.guest_token ? { token: order.guest_token } : {}),
      });
      const callbackURL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bkash-pay?${callbackParams.toString()}`;

      const payload = {
        mode: "0011",
        payerReference: order.order_number || order.id.slice(0, 8),
        callbackURL,
        amount: Number(order.total_amount).toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: order.order_number || order.id.slice(0, 12),
      };

      const result = await bkashApi(creds, token, "/tokenized/checkout/create", payload);
      if (!result.bkashURL || !result.paymentID) {
        return jsonErr(`bKash create failed: ${result.statusMessage || JSON.stringify(result)}`);
      }

      await supabase
        .from("orders")
        .update({
          payment_method: "bkash",
          payment_status: "processing",
        })
        .eq("id", order.id);

      return jsonOk({ bkashURL: result.bkashURL, paymentID: result.paymentID, order_id: order.id });
    }

    // ---------- EXECUTE ----------
    if (action === "execute") {
      const { paymentID } = body;
      if (!paymentID) return jsonErr("paymentID required");

      const token = await grantToken(creds);
      const result = await bkashApi(creds, token, "/tokenized/checkout/execute", { paymentID });

      const isPaid = result.transactionStatus === "Completed" && result.statusCode === "0000";
      // SECURITY: NEVER trust caller-supplied order_id. Bind the payment to the
      // order via bKash's own merchantInvoiceNumber (set during `create`),
      // and verify the executed amount matches the order total.
      const invoiceFromBkash: string | undefined = result.merchantInvoiceNumber;

      if (isPaid && invoiceFromBkash) {
        const { data: ord } = await supabase
          .from("orders")
          .select("id, order_number, total_amount, guest_email, user_id")
          .eq("order_number", invoiceFromBkash)
          .maybeSingle();

        if (ord) {
          // Amount binding: bKash returns `amount` as a string (BDT).
          const paidAmount = Number(result.amount);
          const expectedAmount = Number(ord.total_amount);
          if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expectedAmount) > 0.01) {
            console.error("[bkash-execute] amount mismatch", {
              paidAmount,
              expectedAmount,
              invoice: invoiceFromBkash,
            });
            return jsonErr("Payment amount does not match order total", 200);
          }

          await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", ord.id);

          // Queue receipt email
          const toEmail = ord.guest_email;
          if (toEmail) {
            await supabase.from("email_logs").insert({
              to_address: toEmail,
              subject: `Payment received — ${ord.order_number}`,
              body: `We've received your bKash payment of ${ord.total_amount} BDT for order ${ord.order_number}. Transaction ID: ${result.trxID}`,
              status: "pending",
            });
          }

          return jsonOk({
            paid: true,
            order_id: ord.id,
            trxID: result.trxID,
            transactionStatus: result.transactionStatus,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          paid: false,
          message: result.statusMessage || "Payment not completed",
          details: result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- QUERY ----------
    if (action === "query") {
      const { paymentID } = body;
      if (!paymentID) return jsonErr("paymentID required");
      const token = await grantToken(creds);
      const result = await bkashApi(creds, token, "/tokenized/checkout/payment/status", {
        paymentID,
      });
      return jsonOk({ result });
    }

    return jsonErr(`Unknown action: ${action}`);
  } catch (err) {
    return jsonErr((err as Error).message);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(message: string, status = 200) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
