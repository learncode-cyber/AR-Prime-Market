// Server functions for AI-generated landing page copy.
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

const Schema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  pain_points: z.array(z.object({ title: z.string(), body: z.string() })),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  reviews: z.array(
    z.object({
      name: z.string(),
      rating: z.number(),
      title: z.string(),
      body: z.string(),
      verified: z.boolean().optional(),
    }),
  ),
});

export type LandingCopy = z.infer<typeof Schema>;

async function generateForProduct(productId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { geminiGenerateJson, DEFAULT_GEMINI_MODEL, isGeminiConfigured } =
    await import("@/lib/gemini.server");
  if (!(await isGeminiConfigured("product"))) throw new Error("Gemini API key not configured");

  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("id, title, description, price, gallery_urls, categories(name)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) throw new Error("Product not found");

  const cat = (product as any).categories?.name || "general";

  const system = [
    "You are a world-class direct-response e-commerce copywriter for an international dropshipping store.",
    "Target markets: USA, Canada, UK, EU, Australia, UAE. Prices are in USD. Always English.",
    "Never mention Bangladesh, Dhaka, BDT, or Taka.",
  ].join(" ");

  const prompt = `Write a complete landing page copy package for this product.

Product: ${product.title}
Category: ${cat}
Price: $${product.price}
Description: ${(product.description || "").slice(0, 600)}

Return STRICT JSON with this exact shape (no markdown, no commentary):
{
  "headline": "scroll-stopping benefit-led headline, 6-12 words",
  "subheadline": "one-sentence promise expanding the headline, 12-25 words",
  "pain_points": [
    { "title": "short pain title", "body": "1-2 sentence empathy + solution" },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ],
  "faqs": [
    { "question": "natural buyer question about the product", "answer": "confident 1-3 sentence answer" },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ],
  "reviews": [
    { "name": "First L.", "rating": 5, "title": "short headline", "body": "1-2 sentence review", "verified": true },
    { "name": "...", "rating": 5, "title": "...", "body": "...", "verified": true },
    { "name": "...", "rating": 4, "title": "...", "body": "...", "verified": true },
    { "name": "...", "rating": 5, "title": "...", "body": "...", "verified": true },
    { "name": "...", "rating": 5, "title": "...", "body": "...", "verified": false }
  ]
}

Exactly 3 pain_points, 3 faqs, 5 reviews. Names diverse, realistic, US/UK/AU/CA style. Ratings 4-5. No emojis.`;

  const raw = await geminiGenerateJson<unknown>({
    prompt,
    system,
    surface: "product",
    temperature: 0.7,
  });
  const parsed = Schema.parse(raw);

  const { error: upsertErr } = await supabaseAdmin.from("product_landing_copy").upsert(
    {
      product_id: productId,
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      pain_points: parsed.pain_points,
      faqs: parsed.faqs,
      reviews: parsed.reviews,
      generated_by: DEFAULT_GEMINI_MODEL,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id" },
  );
  if (upsertErr) throw new Error(upsertErr.message);
  return parsed;
}

export const generateLandingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ productId: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (!data.force) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("product_landing_copy")
        .select("product_id")
        .eq("product_id", data.productId)
        .maybeSingle();
      if (existing) {
        return await generateForProduct(data.productId); // refresh on explicit click
      }
    }
    return await generateForProduct(data.productId);
  });

export const getLandingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("product_landing_copy")
      .select("*")
      .eq("product_id", data.productId)
      .maybeSingle();
    return row;
  });

/** Server-side helper used by approval flow. Never throws — logs and returns false. */
export async function generateLandingCopyBackground(productId: string): Promise<boolean> {
  try {
    await generateForProduct(productId);
    return true;
  } catch (e: unknown) {
    console.error("[landing-copy bg]", productId, e instanceof Error ? e.message : String(e));
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_engine_logs").insert({
        engine: "landing-copy",
        status: "error",
        payload: {
          product_id: productId,
          error: (e instanceof Error ? e.message : String(e)) || String(e),
        },
      } as any);
    } catch {
      /* swallow */
    }
    return false;
  }
}
