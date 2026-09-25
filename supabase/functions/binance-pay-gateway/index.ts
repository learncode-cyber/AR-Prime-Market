// Supabase Edge Function: binance-pay-gateway
// Production-grade Binance Pay (crypto checkout) bridge, modeled after Exness's
// automatic checkout flow:
//   - action: "create"  -> creates a Binance Pay order from an existing DB order,
//                          auto-converts USD → USDT (1:1 since USDT is USD-pegged,
//                          with optional FX override via FX rate API for non-USD),
//                          returns { checkoutUrl, qrcodeLink, qrContent, prepayId }.
//   - action: "verify"  -> polls Binance Pay for status, marks order paid on SUCCESS.
//   - action: "webhook" -> receives PAY_SUCCESS / ORDER_PAID notifications from
//                          Binance, verifies HMAC-SHA512 signature, updates DB.
//
// Credentials (Project Secrets):
//   - BINANCE_API_KEY      (BinancePay-Certificate-SN)
//   - BINANCE_SECRET_KEY   (used to sign requests + verify webhooks)
//   - BINANCE_MERCHANT_ID  (optional; included as subMerchantId when present)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, binancepay-timestamp, binancepay-nonce, binancepay-signature, binancepay-certificate-sn",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BINANCE_BASE = "https://bpay.binanceapi.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://arprimemarket.shop";

interface Creds {
  key: string;
  secret: string;
  merchantId: string;
}

function loadCreds(): Creds {
  return {
    key: Deno.env.get("BINANCE_API_KEY") || "",
    secret: Deno.env.get("BINANCE_SECRET_KEY") || "",
    merchantId: Deno.env.get("BINANCE_MERCHANT_ID") || "",
  };
}

async function hmacSha512Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function genNonce(len = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

async function binanceApi(creds: Creds, path: string, payload: unknown) {
  const ts = Date.now().toString();
  const nonce = genNonce();
  const bodyStr = JSON.stringify(payload);
  const signString = `${ts}\n${nonce}\n${bodyStr}\n`;
  const signature = await hmacSha512Hex(creds.secret, signString);

  const res = await fetch(`${BINANCE_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": ts,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": creds.key,
      "BinancePay-Signature": signature,
    },
    body: bodyStr,
  });
  return await res.json();
}

// Auto FX: convert any fiat currency to USDT in real time.
// USDT is USD-pegged, so USD → USDT is 1:1. For non-USD we hit exchangerate.host
// (free, no key) to pull the live USD rate.
async function fiatToUsdt(amount: number, currency: string): Promise<number> {
  const cur = (currency || "USD").toUpperCase();
  if (cur === "USD" || cur === "USDT") return Math.max(0.5, Number(amount.toFixed(2)));
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${cur}&to=USD&amount=${amount}`,
    );
    const json = await res.json();
    const usd = Number(json?.result);
    if (Number.isFinite(usd) && usd > 0) return Math.max(0.5, Number(usd.toFixed(2)));
  } catch (_e) {
    // fall through
  }
  // Conservative fallback for legacy BDT pricing
  if (cur === "BDT") return Math.max(0.5, Number((amount / 110).toFixed(2)));
  return Math.max(0.5, Number(amount.toFixed(2)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Webhook deliveries arrive as raw POST without an `action` field; detect
    // them by Binance signature headers and process before JSON parse so we can
    // verify the raw body bytes.
    const sigHeader =
      req.headers.get("BinancePay-Signature") || req.headers.get("binancepay-signature");
    if (sigHeader && req.method === "POST") {
      return await handleWebhook(req, supabase, sigHeader);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    const creds = loadCreds();

    if (!creds.key || !creds.secret) {
      return jsonErr(
        "Binance Pay credentials not configured. Add BINANCE_API_KEY and BINANCE_SECRET_KEY in Project Settings → Secrets.",
      );
    }

    // ---------- CREATE ----------
    if (action === "create") {
      const { order_id, guest_token } = body;
      if (!order_id) return jsonErr("order_id required");

      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, currency, guest_token, user_id, payment_status")
        .eq("id", order_id)
        .maybeSingle();
      if (!order) return jsonErr("Order not found");

      // Ownership check
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      let callerUserId: string | null = null;
      if (token) {
        const anon = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: u } = await anon.auth.getUser();
        callerUserId = u?.user?.id ?? null;
      }
      const ownsByUser = !!callerUserId && order.user_id === callerUserId;
      const ownsByGuest = !!order.guest_token && !!guest_token && order.guest_token === guest_token;
      if (!ownsByUser && !ownsByGuest) return jsonErr("Forbidden", 403);

      const usdtAmount = await fiatToUsdt(Number(order.total_amount), order.currency || "USD");

      const returnUrl = new URL(`${SITE_URL}/payment/return`);
      returnUrl.searchParams.set("provider", "binance");
      returnUrl.searchParams.set("order_id", order.id);
      if (order.guest_token) returnUrl.searchParams.set("token", order.guest_token);

      const payload: Record<string, unknown> = {
        env: { terminalType: "WEB" },
        merchantTradeNo: (order.order_number || order.id.replace(/-/g, "")).slice(0, 32),
        orderAmount: usdtAmount,
        currency: "USDT",
        goods: {
          goodsType: "02",
          goodsCategory: "Z000",
          referenceGoodsId: order.id.slice(0, 12),
          goodsName: `Order ${order.order_number}`,
        },
        returnUrl: returnUrl.toString(),
        cancelUrl: returnUrl.toString(),
        webhookUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/binance-pay-gateway`,
      };
      if (creds.merchantId) {
        (payload as any).merchant = { subMerchantId: creds.merchantId };
      }

      const result = await binanceApi(creds, "/binancepay/openapi/v3/order", payload);
      if (result.status !== "SUCCESS" || !result.data?.checkoutUrl) {
        return jsonErr(
          `Binance Pay create failed: ${result.errorMessage || result.code || "unknown"}`,
        );
      }

      await supabase
        .from("orders")
        .update({ payment_method: "binance", payment_status: "processing" })
        .eq("id", order.id);

      return jsonOk({
        checkoutUrl: result.data.checkoutUrl,
        qrcodeLink: result.data.qrcodeLink || null,
        qrContent: result.data.qrContent || null,
        deeplink: result.data.deeplink || null,
        universalUrl: result.data.universalUrl || null,
        prepayId: result.data.prepayId,
        order_id: order.id,
        usdt_amount: usdtAmount,
        fiat_amount: order.total_amount,
        fiat_currency: order.currency,
      });
    }

    // ---------- VERIFY ----------
    if (action === "verify") {
      const { prepayId, order_id } = body;
      if (!prepayId && !order_id) return jsonErr("prepayId or order_id required");

      const lookupPayload: Record<string, unknown> = {};
      if (prepayId) {
        lookupPayload.prepayId = prepayId;
      } else if (order_id) {
        const { data: ord } = await supabase
          .from("orders")
          .select("order_number")
          .eq("id", order_id)
          .maybeSingle();
        if (!ord?.order_number) return jsonErr("Order not found");
        lookupPayload.merchantTradeNo = ord.order_number;
      }

      const result = await binanceApi(creds, "/binancepay/openapi/v2/order/query", lookupPayload);
      const status = result.data?.status;

      if (result.status === "SUCCESS" && status === "PAID") {
        const tradeNo = result.data?.merchantTradeNo;
        const { data: ord } = await supabase
          .from("orders")
          .select("id, order_number, total_amount, guest_email")
          .or(`order_number.eq.${tradeNo}${order_id ? `,id.eq.${order_id}` : ""}`)
          .maybeSingle();
        if (ord) {
          await supabase
            .from("orders")
            .update({ payment_status: "paid", updated_at: new Date().toISOString() })
            .eq("id", ord.id);
          return jsonOk({ paid: true, order_id: ord.id, status });
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          paid: false,
          status,
          message: result.errorMessage || "Payment not yet completed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return jsonErr(`Unknown action: ${action}`);
  } catch (err) {
    return jsonErr((err as Error).message);
  }
});

// ---------- WEBHOOK ----------
async function handleWebhook(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  signature: string,
): Promise<Response> {
  const creds = loadCreds();
  const rawBody = await req.text();

  const ts =
    req.headers.get("BinancePay-Timestamp") || req.headers.get("binancepay-timestamp") || "";
  const nonce = req.headers.get("BinancePay-Nonce") || req.headers.get("binancepay-nonce") || "";

  // Per Binance docs: payload = timestamp + "\n" + nonce + "\n" + body + "\n"
  const expected = await hmacSha512Hex(creds.secret, `${ts}\n${nonce}\n${rawBody}\n`);
  if (expected !== signature.toUpperCase()) {
    return new Response(
      JSON.stringify({ returnCode: "FAIL", returnMessage: "Invalid signature" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let event: any = {};
  try {
    event = JSON.parse(rawBody);
  } catch (_e) {
    /* ignore */
  }

  const bizStatus = event?.bizStatus as string | undefined;
  const inner = (() => {
    try {
      return JSON.parse(event?.data || "{}");
    } catch {
      return {};
    }
  })();
  const tradeNo = inner?.merchantTradeNo as string | undefined;

  if (tradeNo && (bizStatus === "PAY_SUCCESS" || bizStatus === "ORDER_PAID")) {
    const { data: ord } = await supabase
      .from("orders")
      .select("id, guest_email, order_number, total_amount")
      .eq("order_number", tradeNo)
      .maybeSingle();
    if (ord) {
      await supabase
        .from("orders")
        .update({ payment_status: "paid", updated_at: new Date().toISOString() })
        .eq("id", ord.id);
      if (ord.guest_email) {
        await supabase.from("email_logs").insert({
          to_address: ord.guest_email,
          subject: `Crypto payment received — ${ord.order_number}`,
          body: `Your Binance Pay transaction for order ${ord.order_number} is confirmed. We're preparing your shipment now.`,
          status: "pending",
        });
      }
    }
  }

  return new Response(JSON.stringify({ returnCode: "SUCCESS", returnMessage: "success" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
