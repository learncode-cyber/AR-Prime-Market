// Competitor Ads Spy server functions — simulates Meta + TikTok scout intel
// for products in the Crew Hunting List, and auto-suggests viral hits.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

const IntelSchema = z.object({
  results: z.array(
    z.object({
      platform: z.enum(["meta", "tiktok"]),
      ad_angle: z.string(),
      hook_text: z.string(),
      hook_rate: z.number(),
      engagement_level: z.enum(["low", "medium", "high", "viral"]),
      likes: z.number(),
      shares: z.number(),
      views: z.number(),
      days_running: z.number(),
    }),
  ),
});

type Candidate = {
  ref: string;
  title: string;
  source_product_id?: string | null;
  source_url?: string | null;
};

async function loadCrewHuntingList(limit = 12): Promise<Candidate[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: Candidate[] = [];
  const seen = new Set<string>();

  // Pending approvals — these are the freshest hunt targets
  const { data: pending } = await supabaseAdmin
    .from("pending_product_approvals")
    .select("id, source_product_id, source_url, preview")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const p of pending || []) {
    const title = (p.preview as any)?.title;
    if (!title) continue;
    const ref = String(p.source_product_id || p.id);
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, title, source_product_id: p.source_product_id, source_url: p.source_url });
  }

  // Top-up from researched_products
  if (out.length < limit) {
    const { data: research } = await supabaseAdmin
      .from("researched_products")
      .select("id, title, external_url")
      .order("created_at", { ascending: false })
      .limit(limit - out.length);
    for (const r of research || []) {
      const ref = String(r.id);
      if (seen.has(ref)) continue;
      seen.add(ref);
      out.push({ ref, title: r.title, source_url: r.external_url });
    }
  }

  return out.slice(0, limit);
}

async function simulateIntelFor(c: Candidate) {
  const { geminiGenerateJson, isGeminiConfigured } = await import("@/lib/gemini.server");
  if (!(await isGeminiConfigured("product"))) {
    // Deterministic fallback simulation if AI not configured.
    return [
      {
        platform: "meta" as const,
        ad_angle: "Problem-Agitate-Solve",
        hook_text: `Tired of overpaying for ${c.title}?`,
        hook_rate: 62,
        engagement_level: "high" as const,
        likes: 4200,
        shares: 980,
        views: 142000,
        days_running: 12,
      },
      {
        platform: "tiktok" as const,
        ad_angle: "POV demo",
        hook_text: `POV: you just found ${c.title} and your life changed`,
        hook_rate: 78,
        engagement_level: "viral" as const,
        likes: 21300,
        shares: 3100,
        views: 1_240_000,
        days_running: 9,
      },
    ];
  }
  const prompt = `Simulate realistic competitor ad intelligence for this dropshipping product as if scraped from Meta Ad Library and TikTok Creative Center.

Product: ${c.title}

Return STRICT JSON: { "results": [ {2-4 entries} ] }

Each entry: { platform: "meta"|"tiktok", ad_angle, hook_text (the spoken/written hook, <=120 chars), hook_rate (0-100), engagement_level: "low"|"medium"|"high"|"viral", likes:int, shares:int, views:int, days_running:int }

Include at least one meta and one tiktok. Numbers should be plausible for dropshipping ads (views 50k-3M, hook_rate 40-95). At least one entry should be "viral" with hook_rate >=80 if the product looks scroll-stopping.`;

  const raw = await geminiGenerateJson<unknown>({ prompt, surface: "product", temperature: 0.85 });
  const parsed = IntelSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.results;
}

export const runCompetitorSpyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(25).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const candidates = await loadCrewHuntingList(data.limit || 8);
    if (candidates.length === 0) {
      return {
        scanned: 0,
        intel_rows: 0,
        viral_hits: 0,
        auto_suggested: 0,
        message: "Crew Hunting List is empty. Run sourcing first.",
      };
    }

    let intelRows = 0;
    let viralHits = 0;
    let autoSuggested = 0;

    for (const c of candidates) {
      let entries: any[];
      try {
        entries = await simulateIntelFor(c);
      } catch (e: unknown) {
        console.error("[spy]", c.title, e instanceof Error ? e.message : String(e));
        continue;
      }

      for (const e of entries) {
        const isViral = e.hook_rate >= 70 || e.engagement_level === "viral";
        const { data: inserted, error } = await supabaseAdmin
          .from("competitor_ad_intel")
          .insert({
            product_ref: c.ref,
            product_title: c.title,
            platform: e.platform,
            ad_angle: e.ad_angle,
            hook_text: e.hook_text,
            hook_rate: e.hook_rate,
            engagement_level: e.engagement_level,
            cta_url: null,
            creative_thumbnail_url: null,
            metrics: {
              likes: e.likes,
              shares: e.shares,
              views: e.views,
              days_running: e.days_running,
            },
            is_viral: isViral,
          })
          .select("id")
          .single();
        if (error || !inserted) continue;
        intelRows++;

        if (isViral) {
          viralHits++;

          // Auto-suggest: if not already in pending_product_approvals, insert a stub
          let pendingId: string | null = null;
          if (c.source_product_id) {
            const { data: existing } = await supabaseAdmin
              .from("pending_product_approvals")
              .select("id")
              .eq("source_product_id", c.source_product_id)
              .maybeSingle();
            if (existing) {
              pendingId = existing.id;
            } else {
              const { data: created } = await supabaseAdmin
                .from("pending_product_approvals")
                .insert({
                  source_provider: "competitor-spy",
                  source_product_id: c.source_product_id,
                  source_url: c.source_url || null,
                  brief: { product_name: c.title, source: "competitor-spy", angle: e.ad_angle },
                  preview: {
                    title: c.title,
                    description: e.hook_text,
                    images: [],
                    source_url: c.source_url,
                  },
                  audit: {
                    polished_title: c.title,
                    verdict: "viral-spy",
                    reason: `Viral on ${e.platform}: ${e.ad_angle}`,
                  },
                  status: "pending",
                  suggested_markup_pct: 80,
                } as any)
                .select("id")
                .single();
              if (created) {
                pendingId = created.id;
                autoSuggested++;
              }
            }
          }

          await supabaseAdmin.from("viral_alerts").insert({
            product_ref: c.ref,
            intel_id: inserted.id,
            auto_suggested: pendingId != null && c.source_product_id != null,
            pending_approval_id: pendingId,
            message: `Viral hit on ${e.platform.toUpperCase()} — ${e.ad_angle} (${e.hook_rate}% hook rate)`,
          });
        }
      }
    }

    return {
      scanned: candidates.length,
      intel_rows: intelRows,
      viral_hits: viralHits,
      auto_suggested: autoSuggested,
      message: `Scanned ${candidates.length} products, generated ${intelRows} ad-intel rows, ${viralHits} viral hits, ${autoSuggested} auto-suggested to approval queue.`,
    };
  });

export const listCompetitorIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        platform: z.enum(["meta", "tiktok"]).optional(),
        onlyViral: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("competitor_ad_intel")
      .select("*")
      .order("scanned_at", { ascending: false })
      .limit(data.limit || 60);
    if (data.platform) q = q.eq("platform", data.platform);
    if (data.onlyViral) q = q.eq("is_viral", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows || [];
  });

export const listViralAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("viral_alerts")
      .select("*")
      .order("notified_at", { ascending: false })
      .limit(data.limit || 25);
    if (error) throw new Error(error.message);
    return rows || [];
  });
