// @ts-nocheck
// Supabase Edge Function: import-product
// 1-click dropshipping import (CJ Dropshipping + AliExpress DS)

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

const SHIPPING_DEFAULT = 3.99;

function priceFromCogs(cogs: number, shipping = SHIPPING_DEFAULT) {
  const retail = Math.ceil(cogs * 3 + shipping);
  const compare = Math.ceil(retail * 1.25);
  return { retail, compare };
}

function slugify(title: string) {
  const base = (title || "product")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `${base}-${Date.now()}`;
}

// ---------- CJ Dropshipping ----------
// Uses the modern Vault CJ_API_KEY + cached cj_tokens flow (same as cj-proxy).
async function getCjAccessToken(admin: any, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const { data: cached } = await admin
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

  const { data: apiKey, error: keyErr } = await admin.rpc("get_cj_api_key");
  if (keyErr) throw new Error(`CJ API key lookup failed: ${keyErr.message}`);
  if (!apiKey) {
    throw new Error(
      "CJ_API_KEY not configured. Open Admin → CJ Connection and save your CJ API key first.",
    );
  }

  const res = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    },
  );
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

  await admin.from("cj_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("cj_tokens").insert({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt.toISOString(),
    refresh_expires_at: refreshExpiresAt.toISOString(),
  });
  return accessToken;
}

function normalizeCjInput(raw: string): { value: string; param: "pid" | "productSku" } {
  const input = (raw || "").trim();
  // Full URL with -p-<digits>
  const cjPid = input.match(/-p-(\d{6,})(?:[._-][^/?#]*)?(?:\.html?)?(?:[/?#]|$)/i);
  if (cjPid) return { value: cjPid[1], param: "pid" };
  // Long numeric inside any URL segment
  const longNum = input.match(/(\d{12,})/);
  if (longNum && /\//.test(input)) return { value: longNum[1], param: "pid" };
  // Raw SKU
  if (/^CJ[A-Z0-9]{4,}$/i.test(input)) return { value: input.toUpperCase(), param: "productSku" };
  // Pure numeric pid
  if (/^\d{6,}$/.test(input)) return { value: input, param: "pid" };
  // Fallback: if contains letters treat as SKU, else as pid
  return /[A-Za-z]/.test(input)
    ? { value: input, param: "productSku" }
    : { value: input, param: "pid" };
}

async function fetchCJ(product_id: string, admin: any) {
  const { value, param } = normalizeCjInput(product_id);

  async function call(token: string, useParam: "pid" | "productSku", useValue: string) {
    const r = await fetch(
      `https://developers.cjdropshipping.com/api2.0/v1/product/query?${useParam}=${encodeURIComponent(useValue)}`,
      {
        headers: {
          "CJ-Access-Token": token,
          "User-Agent": "Mozilla/5.0 (compatible; ARPrimeImporter/1.0)",
          Accept: "application/json",
        },
      },
    );
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }

  let token = await getCjAccessToken(admin);
  let { status, body: prodJson } = await call(token, param, value);
  if (status === 401 || prodJson?.code === 1600100 || prodJson?.code === 1600200) {
    token = await getCjAccessToken(admin, true);
    ({ status, body: prodJson } = await call(token, param, value));
  }

  // Fallback: try the opposite param if first lookup returned no data
  if (!prodJson?.data) {
    const altParam: "pid" | "productSku" = param === "pid" ? "productSku" : "pid";
    const alt = await call(token, altParam, value);
    if (alt.body?.data) prodJson = alt.body;
  }

  const p = prodJson?.data;
  if (!p)
    throw new Error(
      `CJ product not found for ${param}=${value}: ${prodJson?.message || "empty response"}`,
    );

  const title: string = p.productNameEn || p.productName || `CJ ${product_id}`;
  const description: string = p.productDescription || p.description || "";
  const images: string[] =
    Array.isArray(p.productImageSet) && p.productImageSet.length
      ? p.productImageSet
      : Array.isArray(p.productImages) && p.productImages.length
        ? p.productImages
        : p.productImage
          ? [p.productImage]
          : [];
  const cogs = Number(p.sellPrice ?? 0) || 0;

  const rawVariants = Array.isArray(p.variants) ? p.variants : [];
  const variants = rawVariants.map((v: any) => {
    const vCogs = Number(v.variantSellPrice ?? v.sellPrice ?? 0) || cogs;
    const { retail } = priceFromCogs(vCogs);
    return {
      external_variant_id: String(v.vid ?? ""),
      title: v.variantNameEn || v.variantName || "Default",
      option1_name: "Variant",
      option1_value: v.variantNameEn || v.variantName || "Default",
      image_url: v.variantImage || null,
      cogs: vCogs,
      retail_price: retail,
    };
  });

  return { title, description, images, cogs, variants };
}

// ---------- AliExpress DS ----------
async function fetchAliExpress(product_id: string, creds: any) {
  const params = new URLSearchParams({
    method: "aliexpress.ds.product.get",
    app_key: creds.app_key,
    access_token: creds.access_token,
    product_id: product_id,
    ship_to_country: "AE",
    target_currency: "USD",
  });

  const res = await fetch(`https://api-sg.aliexpress.com/sync?${params.toString()}`, {
    method: "POST",
  });
  const data = await res.json();
  const result = data?.aliexpress_ds_product_get_response?.result || data?.result || data;
  const info = result?.ae_item_base_info_dto || result;

  const title: string = info?.subject || `AliExpress ${product_id}`;
  const description: string = info?.detail || "";
  const imagesRaw: string = result?.ae_multimedia_info_dto?.image_urls || info?.image_urls || "";
  const images: string[] = String(imagesRaw)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const skuList =
    result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || result?.ae_item_sku_info_dtos || [];
  const skus = Array.isArray(skuList) ? skuList : [];
  const firstPrice = Number(skus[0]?.sku_price ?? info?.sale_price ?? 0) || 0;
  const cogs = firstPrice;

  const variants = skus.map((s: any) => {
    const vCogs = Number(s.sku_price ?? cogs) || cogs;
    const { retail } = priceFromCogs(vCogs);
    return {
      external_variant_id: String(s.sku_id ?? ""),
      title: String(s.sku_attr || "Default"),
      option1_name: "SKU",
      option1_value: String(s.sku_attr || "Default"),
      image_url: s.sku_image || null,
      cogs: vCogs,
      retail_price: retail,
    };
  });

  return { title, description, images, cogs, variants };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Admin-only: validate JWT and role
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", {
    p_user: userData.user.id,
    p_role: "admin",
  });
  if (!isAdmin) return json({ success: false, error: "Forbidden" }, 403);

  let source: string | undefined;
  let product_id: string | undefined;
  let product_url: string | undefined;

  try {
    const body = await req.json();
    source = body.source;
    product_id = body.product_id;
    product_url = body.product_url;

    if (!source || !product_id) {
      return json({ success: false, error: "source and product_id are required" }, 400);
    }
    if (source !== "cj_dropshipping" && source !== "aliexpress") {
      return json({ success: false, error: "Unsupported source" }, 400);
    }

    // Fetch from supplier (CJ uses Vault-based token; AliExpress uses api_credentials)
    let fetched;
    if (source === "cj_dropshipping") {
      fetched = await fetchCJ(product_id, admin);
    } else {
      const { data: credRow, error: credErr } = await admin
        .from("api_credentials")
        .select("credentials")
        .eq("provider", source)
        .eq("is_active", true)
        .maybeSingle();
      if (credErr) throw new Error(`Credential lookup failed: ${credErr.message}`);
      if (!credRow?.credentials) {
        throw new Error(
          `No active credentials configured for ${source}. Add them in Admin → API Keys.`,
        );
      }
      fetched = await fetchAliExpress(product_id, credRow.credentials as Record<string, any>);
    }

    const cogs = fetched.cogs || 0;
    const shipping_cost = SHIPPING_DEFAULT;
    const { retail, compare } = priceFromCogs(cogs, shipping_cost);

    const slug = slugify(fetched.title);

    // Insert product
    const { data: product, error: prodErr } = await admin
      .from("products")
      .insert({
        external_id: product_id,
        source,
        source_provider: source,
        source_product_id: product_id,
        source_url: product_url || null,
        supplier_url: product_url || null,
        title: fetched.title,
        description: fetched.description,
        slug,
        cogs,
        shipping_cost,
        price: retail,
        compare_at_price: compare,
        currency: "USD",
        status: "draft",
        is_active: false,
        stock_quantity: 0,
        gallery_urls: fetched.images,
        target_markets: ["worldwide"],
      })
      .select("id")
      .single();

    if (prodErr) throw new Error(`Product insert failed: ${prodErr.message}`);
    const productId = product.id;

    // Images
    if (fetched.images.length > 0) {
      const imgRows = fetched.images.map((url, idx) => ({
        product_id: productId,
        url,
        position: idx,
        is_primary: idx === 0,
      }));
      const { error: imgErr } = await admin.from("product_images").insert(imgRows);
      if (imgErr) console.error("Image insert error:", imgErr.message);
    }

    // Variants
    if (fetched.variants.length > 0) {
      const varRows = fetched.variants.map((v) => ({
        product_id: productId,
        name: v.option1_name,
        value: v.option1_value,
        title: v.title,
        option1_name: v.option1_name,
        option1_value: v.option1_value,
        external_variant_id: v.external_variant_id,
        image_url: v.image_url,
        cogs: v.cogs,
        retail_price: v.retail_price,
        is_available: true,
        stock_quantity: 0,
      }));
      const { error: varErr } = await admin.from("product_variants").insert(varRows);
      if (varErr) console.error("Variant insert error:", varErr.message);
    }

    // Success log
    await admin.from("import_logs").insert({
      source,
      external_id: product_id,
      input_url: product_url || null,
      status: "success",
      product_id: productId,
    });

    return json({
      success: true,
      product_id: productId,
      retail_price: retail,
      title: fetched.title,
      image_url: fetched.images[0] || null,
      variant_count: fetched.variants.length,
      cogs,
      compare_price: compare,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("import-product error:", message);
    try {
      await admin.from("import_logs").insert({
        source: source || "unknown",
        external_id: product_id || null,
        input_url: product_url || null,
        status: "failed",
        error_message: message,
      });
    } catch (_) {
      /* ignore */
    }
    return json({ success: false, error: message }, 200);
  }
});
