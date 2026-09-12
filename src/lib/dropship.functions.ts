import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildR2Key, getR2Config, r2PutObject } from "@/lib/r2.server";

// Mirror remote image URLs to our Cloudflare R2 bucket and return the CDN URLs.
// Falls back to the original URL if R2 is not configured or a single fetch fails.
async function mirrorImagesToR2(urls: string[], prefix: string): Promise<string[]> {
  const cfg = getR2Config();
  if (!cfg || !urls.length) return urls;
  const out: string[] = [];
  for (const src of urls) {
    try {
      if (!src || !/^https?:\/\//i.test(src)) {
        out.push(src);
        continue;
      }
      // Skip if already on our R2 CDN
      if (src.includes(cfg.publicDomain)) {
        out.push(src);
        continue;
      }
      const res = await fetch(src);
      if (!res.ok) {
        out.push(src);
        continue;
      }
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await res.arrayBuffer());
      const extFromCt = contentType.split("/")[1]?.split(";")[0] || "jpg";
      const filename = (src.split("?")[0].split("/").pop() || `image.${extFromCt}`)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);
      const key = buildR2Key({ prefix, filename });
      const cdnUrl = await r2PutObject(cfg, key, buf, contentType);
      out.push(cdnUrl);
    } catch (e) {
      console.error("R2 mirror failed for", src, e);
      out.push(src);
    }
  }
  return out;
}

// ---------- Normalized DTO ----------
export type DropshipPreview = {
  provider: "cj" | "aliexpress" | "spocket" | "url";
  source_product_id: string;
  source_url: string;
  title: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  images: string[];
  sku: string | null;
  currency: string;
};

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// ---------- Provider fetchers ----------
async function fetchCJ(identifier: string, supabase: any): Promise<DropshipPreview> {
  // Route through cj-proxy edge function (vault-stored API key, token caching, auto-refresh).
  // CJ accepts numeric pid OR alphanumeric SKU like CJFU241984203CX.
  const trimmed = identifier.trim();
  const urlSkuMatch = trimmed.match(/\/product\/[^/]*?-([A-Z]{2,}[A-Z0-9]+)\.html/i);
  const urlNumMatch = trimmed.match(/\/product\/(?:[^/]*-)?(\d{6,})/);
  const skuMatch = trimmed.match(/^([A-Z]{2,}[A-Z0-9]+)$/i);
  const numMatch = trimmed.match(/^(\d{6,})$/);
  const productId =
    skuMatch?.[1] || urlSkuMatch?.[1] || numMatch?.[1] || urlNumMatch?.[1] || trimmed;

  const { data, error } = await supabase.functions.invoke("cj-proxy", {
    body: { action: "getProduct", productId },
  });
  if (error) {
    throw new Error(
      `[cj-proxy network] ${error.message || error.name || "unreachable"}. ` +
        `Check the cj-proxy edge function deployment and admin auth.`,
    );
  }
  if (data?.error) {
    throw new Error(`[CJ API] ${data.error}`);
  }
  const d = data?.data;
  if (!d || (!d.productNameEn && !d.productName)) {
    throw new Error(
      `[CJ API] No product returned for "${productId}". ` +
        `Verify the SKU/pid and that the CJ_API_KEY in Supabase Vault is active.`,
    );
  }

  const firstVariant = Array.isArray(d.variants) ? d.variants[0] : null;
  const sellPrice =
    Number(d.sellPrice) || (firstVariant ? Number(firstVariant.variantSellPrice) : 0) || 0;
  const rawImages: string[] =
    Array.isArray(d.productImageSet) && d.productImageSet.length
      ? d.productImageSet
      : d.productImage
        ? [d.productImage]
        : [];
  const images = rawImages
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 20);

  return {
    provider: "cj",
    source_product_id: String(d.pid || productId),
    source_url: `https://www.cjdropshipping.com/product/${productId}.html`,
    title: d.productNameEn || d.productName || `CJ ${productId}`,
    description: d.description || d.productDescription || "",
    price: sellPrice,
    compare_at_price: d.originalPrice ? Number(d.originalPrice) : null,
    stock_quantity: Number(d.totalInventory) || 0,
    images,
    sku: d.productSku || firstVariant?.variantSku || null,
    currency: "USD",
  };
}

async function fetchAliExpress(identifier: string): Promise<DropshipPreview> {
  const productId = identifier.match(/(\d{8,})/)?.[1] || identifier;
  // Route via CJ AliExpress search if CJ key present, else scrape.
  return scrapeUrl(`https://www.aliexpress.com/item/${productId}.html`, "aliexpress", productId);
}

async function fetchSpocket(identifier: string): Promise<DropshipPreview> {
  const apiKey = process.env.SPOCKET_API_KEY;
  if (!apiKey) throw new Error("SPOCKET_API_KEY not configured");
  const productId = identifier.replace(/[^a-zA-Z0-9_-]/g, "");
  const res = await fetch(`https://api.spocket.co/api/v1/products/${productId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Spocket error ${res.status}`);
  const d: any = await res.json();
  return {
    provider: "spocket",
    source_product_id: productId,
    source_url: d.url || `https://www.spocket.co/products/${productId}`,
    title: d.title || `Spocket ${productId}`,
    description: d.description || "",
    price: Number(d.retail_price) || 0,
    compare_at_price: d.compare_at_price ? Number(d.compare_at_price) : null,
    stock_quantity: Number(d.inventory) || 0,
    images: Array.isArray(d.images) ? d.images : [],
    sku: d.sku || null,
    currency: d.currency || "USD",
  };
}

async function scrapeUrl(
  url: string,
  provider: "cj" | "aliexpress" | "url",
  sourceId?: string,
): Promise<DropshipPreview> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ARPrimeBot/1.0; +https://arprimemarket.shop)",
      },
    });
    const html = await res.text();
    const pick = (re: RegExp) => html.match(re)?.[1]?.trim() || "";
    const title =
      pick(/<meta property="og:title" content="([^"]+)"/i) ||
      pick(/<title>([^<]+)<\/title>/i) ||
      "Imported product";
    const description = pick(/<meta property="og:description" content="([^"]+)"/i);
    const image = pick(/<meta property="og:image" content="([^"]+)"/i);
    const priceStr =
      pick(/<meta property="product:price:amount" content="([^"]+)"/i) ||
      pick(/"price"\s*:\s*"?([\d.]+)"?/i);
    return {
      provider,
      source_product_id: sourceId || url,
      source_url: url,
      title: decodeHtml(title),
      description: decodeHtml(description),
      price: Number(priceStr) || 0,
      compare_at_price: null,
      stock_quantity: 100,
      images: image ? [image] : [],
      sku: null,
      currency: "USD",
    };
  } catch (e: unknown) {
    throw new Error(`Could not fetch product: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ---------- Server functions ----------
const previewSchema = z.object({
  provider: z.enum(["cj", "aliexpress", "spocket", "url"]),
  identifier: z.string().min(1).max(2048),
});

export const previewDropshipProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => previewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    switch (data.provider) {
      case "cj":
        return fetchCJ(data.identifier, context.supabase);
      case "aliexpress":
        return fetchAliExpress(data.identifier);
      case "spocket":
        return fetchSpocket(data.identifier);
      case "url":
        return scrapeUrl(data.identifier, "url");
    }
  });

const importSchema = z.object({
  preview: z.object({
    provider: z.enum(["cj", "aliexpress", "spocket", "url"]),
    source_product_id: z.string(),
    source_url: z.string(),
    title: z.string().min(1).max(500),
    description: z.string().max(20000),
    price: z.number().min(0),
    compare_at_price: z.number().nullable(),
    stock_quantity: z.number().int().min(0),
    images: z.array(z.string().min(1)).max(50),
    sku: z.string().nullable(),
    currency: z.string().max(8),
  }),
  category_id: z.string().uuid().nullable().optional(),
  price_markup_pct: z.number().min(0).max(1000).default(0),
});

export const importDropshipProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const p = data.preview;
    const finalPrice = +(p.price * (1 + data.price_markup_pct / 100)).toFixed(2);
    const slug =
      p.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) +
      "-" +
      Math.random().toString(36).slice(2, 6);

    // Mirror remote images to Cloudflare R2 so the gallery uses our CDN URLs
    const r2Images = await mirrorImagesToR2(
      p.images,
      `products/${p.provider}/${p.source_product_id || "misc"}`,
    );

    const { data: inserted, error } = await supabaseAdmin
      .from("products")
      .insert({
        title: p.title,
        slug,
        description: p.description,
        price: finalPrice,
        compare_at_price: p.compare_at_price,
        stock_quantity: p.stock_quantity,
        sku: p.sku,
        gallery_urls: r2Images,
        category_id: data.category_id || null,
        currency: "BDT",
        is_active: true,
        source_provider: p.provider,
        source_product_id: p.source_product_id,
        source_url: p.source_url,
        last_stock_sync: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted.id, slug };
  });

const csvSchema = z.object({
  rows: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        price: z.number().min(0),
        stock: z.number().int().min(0).default(0),
        description: z.string().max(20000).default(""),
        images: z.array(z.string().url()).max(20).default([]),
        sku: z.string().max(100).optional(),
        category_id: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const importDropshipCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => csvSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let imported = 0;
    const errors: { row: number; title: string; message: string }[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const row = {
          title: r.title,
          slug:
            r.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 80) +
            "-" +
            Math.random().toString(36).slice(2, 6),
          description: r.description,
          price: r.price,
          stock_quantity: r.stock,
          sku: r.sku || null,
          gallery_urls: r.images,
          category_id: r.category_id || null,
          currency: "BDT",
          is_active: true,
        };
        const { error } = await supabaseAdmin.from("products").insert(row);
        if (error) throw new Error(error.message);
        imported++;
      } catch (e: unknown) {
        errors.push({
          row: i + 2,
          title: r.title,
          message: (e instanceof Error ? e.message : String(e)) || "Insert failed",
        });
      }
    }
    return { imported, failed: errors.length, errors };
  });

export const syncProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: p, error } = await supabaseAdmin
      .from("products")
      .select("id, stock_quantity, source_provider, source_product_id, source_url")
      .eq("id", data.product_id)
      .single();
    if (error || !p) throw new Error("Product not found");
    if (!p.source_provider) throw new Error("Product has no source — manual product");

    let fresh: DropshipPreview;
    try {
      if (p.source_provider === "cj")
        fresh = await fetchCJ(p.source_product_id || "", context.supabase);
      else if (p.source_provider === "aliexpress")
        fresh = await fetchAliExpress(p.source_product_id || "");
      else if (p.source_provider === "spocket")
        fresh = await fetchSpocket(p.source_product_id || "");
      else fresh = await scrapeUrl(p.source_url || "", "url");
    } catch (e: unknown) {
      await supabaseAdmin.from("stock_sync_logs").insert({
        product_id: p.id,
        provider: p.source_provider,
        old_stock: p.stock_quantity,
        status: "error",
        error_message: e instanceof Error ? e.message : String(e),
      });
      throw new Error(e instanceof Error ? e.message : String(e));
    }

    await supabaseAdmin
      .from("products")
      .update({ stock_quantity: fresh.stock_quantity, last_stock_sync: new Date().toISOString() })
      .eq("id", p.id);
    await supabaseAdmin.from("stock_sync_logs").insert({
      product_id: p.id,
      provider: p.source_provider,
      old_stock: p.stock_quantity,
      new_stock: fresh.stock_quantity,
      status: "ok",
    });
    return { old: p.stock_quantity, new: fresh.stock_quantity };
  });
