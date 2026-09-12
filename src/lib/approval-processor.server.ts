// Server-only helper. Imports SERVICE_ROLE supabaseAdmin — must only be
// called from server functions / server routes, never from client modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildR2Key, getR2Config, r2PutObject } from "@/lib/r2.server";

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
      if (src.includes(cfg.publicDomain)) {
        out.push(src);
        continue;
      }
      const res = await fetch(src);
      if (!res.ok) {
        out.push(src);
        continue;
      }
      const ct = res.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await res.arrayBuffer());
      const ext = ct.split("/")[1]?.split(";")[0] || "jpg";
      const filename = (src.split("?")[0].split("/").pop() || `image.${ext}`)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);
      out.push(await r2PutObject(cfg, buildR2Key({ prefix, filename }), buf, ct));
    } catch (e) {
      console.error("[R2 mirror]", src, e);
      out.push(src);
    }
  }
  return out;
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

/**
 * Apply audit polish + markup, mirror images, insert into products, mark pending
 * row as approved. Used by both the admin server fn and the Telegram callback route.
 */
export async function processApprovePending(id: string, decidedBy: string | null) {
  const { data: row, error } = await supabaseAdmin
    .from("pending_product_approvals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Pending approval not found");
  if (row.status === "approved") {
    return { id, approved_product_id: row.approved_product_id, slug: null, already: true };
  }

  const preview = row.preview as any;
  const audit = (row.audit as any) || {};
  const markup = Number(row.suggested_markup_pct) || 80;

  const title = audit.polished_title || preview.title;
  const description = audit.polished_description || preview.description;
  const finalPrice = +((Number(preview.price) || 0) * (1 + markup / 100)).toFixed(2);

  const r2Images = await mirrorImagesToR2(
    Array.isArray(preview.images) ? preview.images : [],
    `products/${preview.provider || "cj"}/${preview.source_product_id || row.source_product_id}`,
  );

  const slug = slugify(title);
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("products")
    .insert({
      title,
      slug,
      description,
      price: finalPrice,
      compare_at_price: preview.compare_at_price ?? null,
      stock_quantity: preview.stock_quantity ?? 0,
      sku: preview.sku ?? null,
      gallery_urls: r2Images,
      category_id: row.category_id || null,
      currency: "BDT",
      is_active: true,
      source_provider: preview.provider || "cj",
      source_product_id: row.source_product_id,
      source_url: row.source_url || preview.source_url,
      last_stock_sync: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (insertErr) {
    await supabaseAdmin
      .from("pending_product_approvals")
      .update({
        status: "failed",
        error_message: insertErr.message,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);
    throw new Error(insertErr.message);
  }

  await supabaseAdmin
    .from("pending_product_approvals")
    .update({
      status: "approved",
      approved_product_id: inserted.id,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Fire-and-forget: kick off AI landing-copy generation. Never blocks approval.
  try {
    const { generateLandingCopyBackground } = await import("@/lib/landing-copy.functions");
    void generateLandingCopyBackground(inserted.id);
  } catch (e) {
    console.error("[landing-copy hook]", e);
  }

  return { id, approved_product_id: inserted.id, slug: inserted.slug, already: false };
}

export async function processRejectPending(id: string, decidedBy: string | null, reason?: string) {
  const { error } = await supabaseAdmin
    .from("pending_product_approvals")
    .update({
      status: "rejected",
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      error_message: reason || null,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return { id, rejected: true };
}
