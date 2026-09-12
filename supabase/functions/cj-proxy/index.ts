// @ts-nocheck
// Supabase Edge Function: cj-proxy
// CJ Dropshipping API proxy + import handler. Uses Supabase Vault for CJ_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, adminClient } from "../_shared/auth.ts";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

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

async function getCjApiKey(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_cj_api_key");
  if (error) {
    console.error("get_cj_api_key error", error);
    return null;
  }
  return (data as string) || null;
}

async function setCjApiKey(supabase: any, apiKey: string): Promise<void> {
  const { error } = await supabase.rpc("set_cj_api_key", { p_key: apiKey });
  if (error) throw new Error(error.message);
}

// Fetch a valid access token. Reuses cached one if not expiring within 1 day.
async function getAccessToken(supabase: any, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("cj_tokens")
      .select("access_token, expires_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.access_token && cached.expires_at) {
      const expiresAt = new Date(cached.expires_at).getTime();
      if (expiresAt - Date.now() > 24 * 60 * 60 * 1000) return cached.access_token;
    }
  }

  const apiKey = await getCjApiKey(supabase);
  if (!apiKey) throw new Error("CJ_API_KEY not configured in Supabase Vault");

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const body = await res.json();
  const data = body?.data;
  if (!data?.accessToken) {
    throw new Error(`CJ auth failed: ${body?.message || "no accessToken"}`);
  }

  const accessToken: string = data.accessToken;
  const refreshToken: string | null = data.refreshToken || null;
  const expiresAt = data.accessTokenExpiryDate
    ? new Date(data.accessTokenExpiryDate)
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const refreshExpiresAt = data.refreshTokenExpiryDate
    ? new Date(data.refreshTokenExpiryDate)
    : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  // Clear old tokens, insert new
  await supabase.from("cj_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("cj_tokens").insert({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt.toISOString(),
    refresh_expires_at: refreshExpiresAt.toISOString(),
  });

  return accessToken;
}

async function cjFetch(
  supabase: any,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<any> {
  const token = await getAccessToken(supabase);
  const res = await fetch(`${CJ_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  // Token expired? code 1600100/1600200 means auth issue
  if (retry && (body?.code === 1600100 || body?.code === 1600200 || res.status === 401)) {
    await getAccessToken(supabase, true);
    return cjFetch(supabase, path, init, false);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req);
  if ("ok" in auth === false) return auth as Response;

  const supabase = adminClient();
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const action = payload?.action as string;

  try {
    switch (action) {
      case "testConnection": {
        const token = await getAccessToken(supabase, true);
        return json({ success: true, hasToken: !!token, message: "CJ connected successfully" });
      }

      case "updateApiKey": {
        const newKey = (payload?.apiKey || "").toString().trim();
        if (!newKey) return json({ error: "apiKey required" }, 400);
        await setCjApiKey(supabase, newKey);
        // Clear cached token so next call uses the new key
        await supabase.from("cj_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        // Validate
        const token = await getAccessToken(supabase, true);
        return json({ success: true, hasToken: !!token, message: "API key saved & validated" });
      }

      case "keyStatus": {
        const key = await getCjApiKey(supabase);
        const { data: tok } = await supabase
          .from("cj_tokens")
          .select("expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return json({
          configured: !!key,
          lastConnectedAt: tok?.created_at || null,
          expiresAt: tok?.expires_at || null,
        });
      }

      case "searchProducts": {
        const params = new URLSearchParams();
        const q = payload?.params || {};
        params.set("pageNum", String(q.pageNum || 1));
        params.set("pageSize", String(q.pageSize || 20));
        if (q.productNameEn) params.set("productNameEn", q.productNameEn);
        if (q.categoryId) params.set("categoryId", q.categoryId);
        const body = await cjFetch(supabase, `/product/list?${params.toString()}`);
        return json(body);
      }

      case "getProduct": {
        const pid = payload?.productId;
        if (!pid) return json({ error: "productId required" }, 400);
        // CJ accepts pid (numeric internal id) or productSku (e.g. CJFU241984203CX)
        const isSku = /[A-Za-z]/.test(String(pid));
        const param = isSku ? "productSku" : "pid";
        const body = await cjFetch(supabase, `/product/query?${param}=${encodeURIComponent(pid)}`);
        return json(body);
      }

      case "getVariants": {
        const vid = payload?.vid;
        if (!vid) return json({ error: "vid required" }, 400);
        const body = await cjFetch(
          supabase,
          `/product/variant/query?vid=${encodeURIComponent(vid)}`,
        );
        return json(body);
      }

      case "getStock": {
        const vid = payload?.vid;
        if (!vid) return json({ error: "vid required" }, 400);
        const body = await cjFetch(
          supabase,
          `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`,
        );
        return json(body);
      }

      case "importProduct": {
        const pid = payload?.productId;
        if (!pid) return json({ error: "productId required" }, 400);
        const prod = await cjFetch(supabase, `/product/query?pid=${encodeURIComponent(pid)}`);
        const p = prod?.data;
        if (!p) return json({ error: prod?.message || "Product not found" }, 404);

        // Best-effort stock fetch for first variant
        let stockInfo: any = {};
        const firstVid = p?.variants?.[0]?.vid;
        if (firstVid) {
          try {
            const stock = await cjFetch(
              supabase,
              `/product/stock/queryByVid?vid=${encodeURIComponent(firstVid)}`,
            );
            stockInfo = stock?.data || {};
          } catch {
            /* ignore */
          }
        }

        const row = {
          cj_pid: String(p.pid || pid),
          product_name: p.productNameEn || p.productName || "Untitled",
          product_name_en: p.productNameEn || null,
          product_image: p.productImage || (p.productImageSet?.[0] ?? null),
          product_description: p.description || p.productDescription || null,
          sell_price: typeof p.sellPrice === "number" ? p.sellPrice : Number(p.sellPrice) || null,
          product_status: p.productStatus ?? 3,
          category_id: p.categoryId ? String(p.categoryId) : null,
          category_name: p.categoryName || null,
          variants: p.variants || [],
          stock_info: stockInfo,
          last_synced_at: new Date().toISOString(),
        };

        const { data: upserted, error } = await supabase
          .from("imported_products")
          .upsert(row, { onConflict: "cj_pid" })
          .select()
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, product: upserted });
      }

      case "syncProduct": {
        const pid = payload?.productId;
        if (!pid) return json({ error: "productId required" }, 400);
        const prod = await cjFetch(supabase, `/product/query?pid=${encodeURIComponent(pid)}`);
        const p = prod?.data;
        if (!p) return json({ error: prod?.message || "Product not found" }, 404);

        let stockInfo: any = {};
        const firstVid = p?.variants?.[0]?.vid;
        if (firstVid) {
          try {
            const stock = await cjFetch(
              supabase,
              `/product/stock/queryByVid?vid=${encodeURIComponent(firstVid)}`,
            );
            stockInfo = stock?.data || {};
          } catch {
            /* ignore */
          }
        }

        const { error } = await supabase
          .from("imported_products")
          .update({
            product_name: p.productNameEn || p.productName,
            product_image: p.productImage || (p.productImageSet?.[0] ?? null),
            sell_price: typeof p.sellPrice === "number" ? p.sellPrice : Number(p.sellPrice) || null,
            product_status: p.productStatus ?? 3,
            variants: p.variants || [],
            stock_info: stockInfo,
            last_synced_at: new Date().toISOString(),
          })
          .eq("cj_pid", String(pid));
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("cj-proxy error", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
