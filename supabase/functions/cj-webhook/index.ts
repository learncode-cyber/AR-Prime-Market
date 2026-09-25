// @ts-nocheck
// Supabase Edge Function: cj-webhook
// Receives CJ Dropshipping webhooks. Public (verify_jwt=false). Returns 200 quickly.

import { adminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: unknown = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleEvent(payload: any) {
  const supabase = adminClient();
  const type = (payload?.type || payload?.messageType || "UNKNOWN").toString().toUpperCase();
  const data = payload?.data || payload?.message || payload;
  const pid = data?.pid || data?.productId || null;

  // Log received event first
  const { data: logRow } = await supabase
    .from("cj_webhook_events")
    .insert({
      event_type: type,
      cj_pid: pid ? String(pid) : null,
      payload,
      status: "received",
    })
    .select("id")
    .single();

  const logId = logRow?.id;
  const markStatus = async (status: string, error_message: string | null = null) => {
    if (!logId) return;
    await supabase
      .from("cj_webhook_events")
      .update({ status, error_message, processed_at: new Date().toISOString() })
      .eq("id", logId);
  };

  try {
    if (type === "STOCK") {
      if (!pid) return await markStatus("skipped", "missing pid");
      const { data: existing } = await supabase
        .from("imported_products")
        .select("stock_info")
        .eq("cj_pid", String(pid))
        .maybeSingle();
      const next = {
        ...(existing?.stock_info || {}),
        ...(data?.stock || data || {}),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from("imported_products")
        .update({ stock_info: next, last_synced_at: new Date().toISOString() })
        .eq("cj_pid", String(pid));
      await markStatus("processed");
    } else if (type === "PRODUCT") {
      if (!pid) return await markStatus("skipped", "missing pid");
      const patch: any = { last_synced_at: new Date().toISOString() };
      if (data?.productStatus !== undefined) patch.product_status = Number(data.productStatus);
      if (data?.sellPrice !== undefined) patch.sell_price = Number(data.sellPrice);
      if (data?.productName) patch.product_name = data.productName;
      if (data?.productImage) patch.product_image = data.productImage;
      await supabase.from("imported_products").update(patch).eq("cj_pid", String(pid));
      await markStatus("processed");
    } else if (type === "VARIANT") {
      if (!pid) return await markStatus("skipped", "missing pid");
      const { data: existing } = await supabase
        .from("imported_products")
        .select("variants")
        .eq("cj_pid", String(pid))
        .maybeSingle();
      const variants = Array.isArray(existing?.variants) ? [...existing.variants] : [];
      const vid = data?.vid;
      if (vid) {
        const idx = variants.findIndex((v: any) => String(v?.vid) === String(vid));
        if (idx >= 0) variants[idx] = { ...variants[idx], ...data };
        else variants.push(data);
      }
      await supabase
        .from("imported_products")
        .update({ variants, last_synced_at: new Date().toISOString() })
        .eq("cj_pid", String(pid));
      await markStatus("processed");
    } else {
      await markStatus("ignored", `unsupported type: ${type}`);
    }
  } catch (err) {
    console.error("cj-webhook handler error", err);
    await markStatus("error", String((err as any)?.message || err));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok({ ignored: true });

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify HMAC-SHA256 signature using shared secret from env or integration_secrets
  const provided = req.headers.get("x-cj-signature") || req.headers.get("x-signature") || "";
  let secret = Deno.env.get("CJ_WEBHOOK_SECRET") || "";
  if (!secret) {
    try {
      const { data } = await adminClient()
        .from("integration_secrets")
        .select("api_key")
        .eq("provider", "cj_webhook")
        .maybeSingle();
      secret = (data?.api_key as string) || "";
    } catch {
      /* ignore */
    }
  }
  if (!secret) {
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time compare
  const a = expected.toLowerCase();
  const b = provided.toLowerCase().replace(/^sha256=/, "");
  if (a.length !== b.length) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff !== 0) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return ok({ ignored: "invalid json" });
  }

  try {
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(handleEvent(payload));
    } else {
      handleEvent(payload);
    }
  } catch (e) {
    console.error("cj-webhook dispatch error", e);
  }
  return ok();
});
