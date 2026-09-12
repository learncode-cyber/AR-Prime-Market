// @ts-nocheck
// Supabase Edge Function: process-order
// Routes orders to SteadFast (BD) or CJ Dropshipping (international)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getCredentials(provider: string) {
  const { data, error } = await supabase
    .from("api_credentials")
    .select("credentials")
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Credentials lookup failed for ${provider}: ${error.message}`);
  if (!data?.credentials) throw new Error(`No active credentials for ${provider}`);
  return data.credentials as Record<string, string>;
}

function formatBdPhone(raw: string): string {
  let p = (raw || "").replace(/\s|-/g, "");
  if (p.startsWith("+880")) p = p.slice(4);
  else if (p.startsWith("880")) p = p.slice(3);
  if (!p.startsWith("0")) p = "0" + p;
  return p;
}

function joinAddress(parts: (string | null | undefined)[]): string {
  return parts
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");
}

// ---------- SteadFast Flow ----------
async function dispatchSteadfast(order: any) {
  const creds = await getCredentials("steadfast");
  const phone = formatBdPhone(order.customer_phone || "");
  const address = joinAddress([
    order.shipping_line1,
    order.shipping_line2,
    order.shipping_city,
    order.shipping_state,
  ]);

  const body = {
    invoice: order.order_number,
    recipient_name: order.customer_name,
    recipient_phone: phone,
    recipient_address: address,
    cod_amount: Math.round(Number(order.total_amount) || 0),
    note: order.customer_note || "",
  };

  let resp: Response;
  try {
    resp = await fetch("https://portal.steadfast.com.bd/api/v1/create_order", {
      method: "POST",
      headers: {
        "Api-Key": creds.api_key,
        "Secret-Key": creds.secret_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = `SteadFast network error: ${(e as Error).message}`;
    await supabase.from("orders").update({ admin_note: msg }).eq("id", order.id);
    return { success: false, error: msg };
  }

  const data = await resp.json().catch(() => ({}));

  if (resp.status === 200 && data?.consignment) {
    const trackingCode = data.consignment.tracking_code;
    await supabase
      .from("orders")
      .update({
        fulfillment_channel: "steadfast",
        fulfillment_status: "processing",
        courier_consignment_id: String(data.consignment.consignment_id ?? ""),
        tracking_number: trackingCode,
        tracking_url: trackingCode ? `https://steadfast.com.bd/t/${trackingCode}` : null,
        status: "confirmed",
      })
      .eq("id", order.id);
    return { success: true, channel: "steadfast", tracking_number: trackingCode };
  }

  const errDetail = data?.message || JSON.stringify(data) || `HTTP ${resp.status}`;
  await supabase
    .from("orders")
    .update({ admin_note: `SteadFast error: ${errDetail}` })
    .eq("id", order.id);
  return { success: false, error: errDetail };
}

// ---------- CJ Dropshipping Flow ----------
async function dispatchCJ(order: any, items: any[]) {
  let creds: any;
  try {
    creds = await getCredentials("cj_dropshipping");
  } catch (e) {
    await supabase
      .from("orders")
      .update({
        fulfillment_channel: "manual",
        admin_note: "CJ credentials missing - manual fulfillment needed",
      })
      .eq("id", order.id);
    return { success: true, channel: "manual" };
  }

  try {
    const tokenResp = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: creds.email, password: creds.password }),
      },
    );
    const tokenData = await tokenResp.json().catch(() => ({}));
    const accessToken = tokenData?.data?.accessToken;
    if (!accessToken) throw new Error(tokenData?.message || "CJ token missing");

    const orderBody = {
      orderNumber: order.order_number,
      shippingCountryCode: order.shipping_country,
      shippingCountry: order.shipping_country_name,
      shippingProvince: order.shipping_state || "",
      shippingCity: order.shipping_city,
      shippingAddress: order.shipping_line1,
      shippingAddress2: order.shipping_line2 || "",
      shippingZip: order.shipping_postal_code || "",
      shippingCustomerName: order.customer_name,
      shippingPhone: (order.customer_phone || "").replace(/^\+/, ""),
      products: items.map((it: any) => ({
        vid: it.supplier_variant_id || it.supplier_product_id,
        quantity: it.quantity,
      })),
      remark: order.customer_note || "",
    };

    const createResp = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CJ-Access-Token": accessToken,
        },
        body: JSON.stringify(orderBody),
      },
    );
    const createData = await createResp.json().catch(() => ({}));

    if (createData?.result === true && createData?.data?.orderId) {
      await supabase
        .from("orders")
        .update({
          fulfillment_channel: "cj_dropshipping",
          fulfillment_status: "processing",
          supplier_order_id: String(createData.data.orderId),
          status: "confirmed",
        })
        .eq("id", order.id);
      return { success: true, channel: "cj_dropshipping" };
    }
    throw new Error(createData?.message || "CJ createOrder failed");
  } catch (e) {
    await supabase
      .from("orders")
      .update({
        fulfillment_channel: "manual",
        admin_note: `CJ push failed - manual fulfillment needed: ${(e as Error).message}`,
      })
      .eq("id", order.id);
    return { success: true, channel: "manual" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: require an authenticated user; allow admins or order owner
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ success: false, error: "Unauthorized" }, 401);
    const callerId = u.user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", { p_user: callerId, p_role: "admin" });

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ success: false, error: "order_id required" }, 400);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) return json({ success: false, error: "Order not found" }, 404);

    // Owner-or-admin check
    if (!isAdmin && order.user_id && order.user_id !== callerId) {
      return json({ success: false, error: "Forbidden" }, 403);
    }
    if (!isAdmin && !order.user_id) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    // Idempotency: don't re-dispatch already processing/fulfilled orders
    if (order.fulfillment_status === "processing" || order.fulfillment_status === "fulfilled") {
      return json({
        success: true,
        channel: order.fulfillment_channel,
        status: order.fulfillment_status,
      });
    }

    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("*, products(source, external_id, target_markets)")
      .eq("order_id", order_id);
    if (itemsErr) return json({ success: false, error: itemsErr.message }, 500);

    const isBD = order.shipping_country === "BD";
    const requiredMarket = isBD ? "bangladesh" : "worldwide";
    const ineligible = (items || []).filter((it: any) => {
      const tm: string[] = it.products?.target_markets || [];
      return tm.length > 0 && !tm.includes(requiredMarket);
    });
    if (ineligible.length > 0) {
      const names = ineligible.map((it: any) => it.title).join(", ");
      const msg = `Product not available for destination (${requiredMarket}): ${names}`;
      await supabase
        .from("orders")
        .update({ fulfillment_channel: "manual", admin_note: msg })
        .eq("id", order_id);
      return json({ success: false, error: msg }, 422);
    }

    if (isBD) {
      const r = await dispatchSteadfast(order);
      return json(r, r.success ? 200 : 502);
    }
    const r = await dispatchCJ(order, items || []);
    return json(r);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
