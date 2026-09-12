// Server-only AI agent helpers (no HTTP/middleware). Used by both the
// stand-alone agent server functions and the autonomous sourcing pipeline.

import { geminiGenerateJson } from "@/lib/gemini.server";

export type WinningProductBrief = {
  product_name: string;
  category: string;
  why_winning: string;
  target_audience: string;
  viral_angles: string[];
  ad_hooks: string[];
  search_terms: string[];
  suggested_price_usd: number;
  suggested_margin_pct: number;
};

export type SourcingAudit = {
  polished_title: string;
  polished_description: string;
  suggested_markup_pct: number;
  warehouses: string[];
  shipping_notes: string;
  supplier_score: number;
  risk_flags: string[];
  verdict: "approve" | "review" | "reject";
  reasoning: string;
};

export type AuditPreview = {
  provider: string;
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

export async function trendHunter(input: { niche?: string; count: number }) {
  const niche = input.niche?.trim() || "general high-demand dropshipping";
  const prompt = `You are "Trend Hunter", an elite dropshipping product researcher
for an international store (US/CA/UK/EU/AU/UAE). Generate ${input.count} fresh
WINNING PRODUCT BRIEFS in the "${niche}" space.

Focus on items that are:
- Currently trending on TikTok / Meta Ads (2025-2026).
- Solve a clear problem or trigger strong emotional impulse.
- Light, cheap to ship from CN/US/EU warehouses.
- Have a 3x+ retail markup ceiling.

Return strict JSON:
{ "briefs": [ {
  "product_name": string,
  "category": "Electronics"|"Beauty"|"Fashion"|"Home"|"Gadgets",
  "why_winning": string,
  "target_audience": string,
  "viral_angles": string[3-5],
  "ad_hooks": string[3-5],
  "search_terms": string[5-8],
  "suggested_price_usd": number,
  "suggested_margin_pct": number
} ] }`;
  const json = await geminiGenerateJson<{ briefs: WinningProductBrief[] }>({
    prompt,
    temperature: 0.85,
    surface: "trend_hunter",
  });
  return { briefs: Array.isArray(json?.briefs) ? json.briefs.slice(0, input.count) : [] };
}

export async function sourcingAuditor(preview: AuditPreview): Promise<SourcingAudit> {
  const signals = {
    title_len: preview.title.length,
    has_broken_english: /\b(s\s+s|hot\s+sales|good\s+quality|new\s+arrival|wholesale)\b/i.test(
      preview.title,
    ),
    has_chinese:
      /[\u4e00-\u9fff]/.test(preview.title) || /[\u4e00-\u9fff]/.test(preview.description),
    stock: preview.stock_quantity,
    images: preview.images.length,
    cost_price: preview.price,
  };

  const prompt = `You are "Sourcing Auditor", a strict QA agent for a USD-priced
international dropshipping store. Audit this CJ Dropshipping product before
it is imported. Polish copy for Western buyers, flag any risks, and recommend
a profit-margin markup that lands at a clean retail price (.99 / .95).

Raw payload:
${JSON.stringify({ ...preview, images: preview.images.slice(0, 3) }, null, 2)}

Heuristic signals: ${JSON.stringify(signals)}

Rules:
- polished_title: 50-70 chars, benefit-led, native English, no ALL CAPS, no emojis.
- polished_description: 80-160 words, scannable paragraphs + a short bullet list of 3-5 features. Plain text (no markdown headings).
- suggested_markup_pct: 80-250 typically; higher for impulse/beauty/gadget, lower for bulky/low-ticket.
- warehouses: infer likely fulfillment regions from SKU prefix / title hints. Use codes like "CN", "US", "EU", "UK".
- shipping_notes: 1 sentence on fastest viable line (e.g. "CJPacket Liquid 8-14d to US").
- supplier_score: 0-100. Penalize low stock (<20), <3 images, broken-English title, missing description.
- risk_flags: short strings, e.g. "low_stock", "trademark_risk", "fragile", "battery_restricted", "broken_english_copy".
- verdict: "approve" if score>=70 and no critical flag; "review" if 50-69; "reject" if <50 or trademark risk.

Return strict JSON exactly:
{
  "polished_title": string,
  "polished_description": string,
  "suggested_markup_pct": number,
  "warehouses": string[],
  "shipping_notes": string,
  "supplier_score": number,
  "risk_flags": string[],
  "verdict": "approve"|"review"|"reject",
  "reasoning": string
}`;

  const audit = await geminiGenerateJson<SourcingAudit>({
    prompt,
    temperature: 0.3,
    surface: "sourcing_auditor",
  });

  return {
    polished_title: (audit.polished_title || preview.title).slice(0, 200),
    polished_description: (audit.polished_description || preview.description).slice(0, 4000),
    suggested_markup_pct: Math.max(0, Math.min(500, Number(audit.suggested_markup_pct) || 80)),
    warehouses: Array.isArray(audit.warehouses) ? audit.warehouses.slice(0, 6) : [],
    shipping_notes: (audit.shipping_notes || "").slice(0, 300),
    supplier_score: Math.max(0, Math.min(100, Number(audit.supplier_score) || 0)),
    risk_flags: Array.isArray(audit.risk_flags) ? audit.risk_flags.slice(0, 10) : [],
    verdict: (["approve", "review", "reject"] as const).includes(audit.verdict as any)
      ? audit.verdict
      : "review",
    reasoning: (audit.reasoning || "").slice(0, 1000),
  };
}
