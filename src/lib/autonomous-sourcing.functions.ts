// Autonomous Sourcing Pipeline server functions.
//
// runAutonomousSourcing: Trend Hunter -> CJ search -> Sourcing Auditor ->
// drop into pending_product_approvals + ping Telegram with inline buttons.
//
// approvePending / rejectPending: dashboard actions for the approval queue.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  trendHunter,
  sourcingAuditor,
  type WinningProductBrief,
  type SourcingAudit,
} from "@/lib/agents-dropship.server";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

type CjPreview = {
  provider: "cj";
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

function normalizeCjProduct(d: any, fallbackId: string): CjPreview | null {
  if (!d || (!d.productNameEn && !d.productName)) return null;
  const firstVariant = Array.isArray(d.variants) ? d.variants[0] : null;
  const sellPrice =
    Number(d.sellPrice) || (firstVariant ? Number(firstVariant.variantSellPrice) : 0) || 0;
  const raw: string[] =
    Array.isArray(d.productImageSet) && d.productImageSet.length
      ? d.productImageSet
      : d.productImage
        ? [d.productImage]
        : [];
  const images = raw.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)).slice(0, 20);
  return {
    provider: "cj",
    source_product_id: String(d.pid || fallbackId),
    source_url: `https://www.cjdropshipping.com/product/${d.pid || fallbackId}.html`,
    title: d.productNameEn || d.productName || `CJ ${fallbackId}`,
    description: d.description || d.productDescription || "",
    price: sellPrice,
    compare_at_price: d.originalPrice ? Number(d.originalPrice) : null,
    stock_quantity: Number(d.totalInventory) || 0,
    images,
    sku: d.productSku || firstVariant?.variantSku || null,
    currency: "USD",
  };
}

async function notifyTelegramApproval(
  pendingId: string,
  preview: CjPreview,
  audit: SourcingAudit,
  brief: WinningProductBrief | null,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return { sent: false, reason: "telegram_not_configured" } as const;

  const lines = [
    "🛒 <b>Pending Crew Approval</b>",
    `<b>${escape(audit.polished_title || preview.title).slice(0, 120)}</b>`,
    brief ? `Niche: <i>${escape(brief.category)} · ${escape(brief.product_name)}</i>` : "",
    `Cost: $${preview.price.toFixed(2)} · Markup: ${audit.suggested_markup_pct}% · Score: ${audit.supplier_score}/100 (${audit.verdict})`,
    audit.warehouses?.length ? `Warehouses: ${audit.warehouses.join(", ")}` : "",
    audit.risk_flags?.length ? `⚠️ ${audit.risk_flags.join(", ")}` : "",
    `Stock: ${preview.stock_quantity} · SKU: ${escape(preview.sku || "—")}`,
  ]
    .filter(Boolean)
    .join("\n");

  let msgId: number | null = null;
  if (preview.images[0]) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: preview.images[0],
        caption: lines.slice(0, 1000),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve & Import", callback_data: `ap:${pendingId}` },
              { text: "❌ Reject", callback_data: `rj:${pendingId}` },
            ],
          ],
        },
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    msgId = body?.result?.message_id ?? null;
  } else {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.slice(0, 3500),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve & Import", callback_data: `ap:${pendingId}` },
              { text: "❌ Reject", callback_data: `rj:${pendingId}` },
            ],
          ],
        },
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    msgId = body?.result?.message_id ?? null;
  }
  return { sent: true, chatId, messageId: msgId } as const;
}

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const runAutonomousSourcing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        niche: z.string().max(120).optional(),
        count: z.number().int().min(1).max(6).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Agent 1: Trend Hunter
    const { briefs } = await trendHunter({ niche: data.niche, count: data.count });
    if (!briefs.length) throw new Error("Trend Hunter returned no briefs");

    const queued: Array<{ id: string; title: string; verdict: string; telegram?: boolean }> = [];
    const errors: Array<{ brief: string; message: string }> = [];

    for (const brief of briefs) {
      const term = brief.search_terms?.[0] || brief.product_name;
      try {
        // Agent 2 step A: search CJ
        const { data: searchRes, error: searchErr } = await context.supabase.functions.invoke(
          "cj-proxy",
          {
            body: {
              action: "searchProducts",
              params: { productNameEn: term, pageNum: 1, pageSize: 5 },
            },
          },
        );
        if (searchErr) throw new Error(`cj-proxy search: ${searchErr.message}`);
        if (searchRes?.error) throw new Error(`CJ search: ${searchRes.error}`);
        const list: any[] = searchRes?.data?.list || searchRes?.data?.content || [];
        const top = list.find((p) => p?.pid) || list[0];
        if (!top?.pid) {
          errors.push({ brief: brief.product_name, message: `No CJ results for "${term}"` });
          continue;
        }

        // Agent 2 step B: full product
        const { data: detailRes, error: detailErr } = await context.supabase.functions.invoke(
          "cj-proxy",
          {
            body: { action: "getProduct", productId: String(top.pid) },
          },
        );
        if (detailErr) throw new Error(`cj-proxy detail: ${detailErr.message}`);
        if (detailRes?.error) throw new Error(`CJ detail: ${detailRes.error}`);
        const preview = normalizeCjProduct(detailRes?.data, String(top.pid));
        if (!preview) {
          errors.push({ brief: brief.product_name, message: "Empty CJ payload" });
          continue;
        }

        // Agent 2 step C: audit + polish
        const audit = await sourcingAuditor(preview);
        if (audit.verdict === "reject") {
          errors.push({
            brief: brief.product_name,
            message: `Auditor rejected: ${audit.risk_flags.join(", ") || "low score"}`,
          });
          continue;
        }

        // Stash in approval queue
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("pending_product_approvals")
          .insert({
            source_provider: "cj",
            source_product_id: preview.source_product_id,
            source_url: preview.source_url,
            brief: brief as any,
            preview: preview as any,
            audit: audit as any,
            suggested_markup_pct: audit.suggested_markup_pct || brief.suggested_margin_pct || 80,
            status: "pending",
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);

        // Telegram ping (best-effort)
        let tg: { sent: boolean; chatId?: string; messageId?: number | null } = { sent: false };
        try {
          tg = await notifyTelegramApproval(inserted.id, preview, audit, brief);
        } catch (e: unknown) {
          console.warn("[tg notify]", e instanceof Error ? e.message : String(e));
        }
        if (tg.sent && tg.messageId != null) {
          await supabaseAdmin
            .from("pending_product_approvals")
            .update({
              telegram_chat_id: tg.chatId,
              telegram_message_id: tg.messageId,
            })
            .eq("id", inserted.id);
        }

        queued.push({
          id: inserted.id,
          title: audit.polished_title || preview.title,
          verdict: audit.verdict,
          telegram: tg.sent,
        });
      } catch (e: unknown) {
        errors.push({
          brief: brief.product_name,
          message: (e instanceof Error ? e.message : String(e)) || String(e),
        });
      }
    }

    return { queued, errors, briefs_count: briefs.length };
  });

export const approvePending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { processApprovePending } = await import("@/lib/approval-processor.server");
    return processApprovePending(data.id, context.userId);
  });

export const rejectPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { processRejectPending } = await import("@/lib/approval-processor.server");
    return processRejectPending(data.id, context.userId, data.reason);
  });
