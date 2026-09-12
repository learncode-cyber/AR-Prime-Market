import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { researchKeyword } from "./keyword-research.server";
import { geminiGenerateJson, geminiGenerateImage } from "./gemini.server";
import { loadSharedAgentMemory, buildSharedLearningBlock } from "./ai-memory";

const NICHE = [
  "travel gadgets",
  "trending tech accessories",
  "smart home devices",
  "premium beauty tools",
  "fashion accessories",
  "fitness gadgets",
  "outdoor & camping gear",
  "luxury lifestyle products",
];
const REGIONS = ["UAE", "Saudi Arabia", "USA", "UK", "Europe", "Middle East", "Global"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function callAiJson(prompt: string) {
  return await geminiGenerateJson<any>({
    system:
      "You are an SEO content writer for AR Prime Market, a global e-commerce store focused on travel gadgets and trending products for UAE, USA, UK, Saudi Arabia, Europe, and Middle East. Respond ONLY with valid JSON.",
    prompt,
    temperature: 0.7,
    surface: "blog",
  });
}

async function generateAndUploadImage(prompt: string, slug: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const result = await geminiGenerateImage({
      prompt: `High-quality, photorealistic 16:9 hero blog cover image. ${prompt}. Clean composition, professional product/lifestyle photography, no text overlay, no watermark.`,
      surface: "blog",
    });
    if (!result) return null;
    const { b64, mime } = result;
    const ext = mime.split("/")[1] || "png";
    const path = `ai-generated/${slug}-${Date.now()}.${ext}`;

    // Try ImgBB if active, else fall back to Supabase Storage. Same logic as
    // the in-app upload server fn — duplicated here because this runs server-side
    // before any user context is available.
    const [secretRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("integration_secrets")
        .select("api_key")
        .eq("provider", "imgbb")
        .maybeSingle(),
      supabaseAdmin
        .from("integration_settings")
        .select("is_active")
        .eq("provider", "imgbb")
        .maybeSingle(),
    ]);
    const apiKey = (secretRes.data as any)?.api_key as string | undefined;
    const isActive = !!(settingsRes.data as any)?.is_active;

    if (apiKey && isActive) {
      try {
        const form = new FormData();
        form.append("image", b64);
        form.append("name", slug);
        const res2 = await fetch(
          `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            body: form,
          },
        );
        if (res2.ok) {
          const json: any = await res2.json();
          const url: string | undefined = json?.data?.url || json?.data?.display_url;
          if (url) return url;
        } else {
          console.error("[blog-ai] imgbb upload failed", res2.status);
        }
      } catch (e: unknown) {
        console.error(
          "[blog-ai] imgbb upload error",
          (e instanceof Error ? e.message : String(e)) || e,
        );
      }
      // fall through to Supabase fallback on failure
    }

    const buffer = Buffer.from(b64, "base64");
    const { error: upErr } = await supabaseAdmin.storage
      .from("blog-images")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (upErr) {
      console.error("Image upload failed:", upErr.message);
      return null;
    }
    const { data: pub } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);
    return pub.publicUrl;
  } catch (e: unknown) {
    console.error("Image generation error:", (e instanceof Error ? e.message : String(e)) || e);
    return null;
  }
}

export async function runBlogGeneration(
  triggeredBy: "cron" | "manual" = "cron",
  autoPublish: boolean = true,
  customPrompt?: string,
) {
  const startedAt = Date.now();
  const niche = pick(NICHE);
  const region = pick(REGIONS);
  let primaryKeyword: string | null = null;

  // Run keyword research first (uses configured provider, else LLM fallback)
  let researchBlock = "";
  if (!customPrompt || customPrompt.trim().length === 0) {
    try {
      const research = await researchKeyword(niche);
      researchBlock = `

KEYWORD RESEARCH (provider: ${research.provider}):
- Primary keyword: ${research.primary}
- Secondary: ${research.secondary.join(", ")}
- Long-tail: ${research.longTail.join(", ")}
- Competitor topics to outperform: ${(research.competitorTopics || []).join("; ")}

Use the PRIMARY keyword in the title, H1, slug, meta_title, and first paragraph. Weave secondary + long-tail naturally.`;
    } catch (e: unknown) {
      console.warn(
        "[blog-ai] keyword research failed, continuing without:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  const basePrompt =
    customPrompt && customPrompt.trim().length > 0
      ? `Write ONE SEO-optimised English blog post based on this brief from the editor:

"""
${customPrompt.trim()}
"""

Follow the brief faithfully. Pick a high-intent long-tail keyword that real shoppers search for.`
      : `Generate ONE SEO-optimised English blog post about a trending "${niche}" product for shoppers in ${region}.${researchBlock}`;

  const prompt = `${basePrompt}

ARTICLE FORMAT — write in the style of Dropship.io trending-product roundups:
- Pick 5 trending, high-margin dropshipping products in the "${niche}" niche.
- For EACH product render a clean HTML <table class="product-table"> with rows:
  AliExpress Price, Amazon Price, Net Profit Margin, Saturation Level (Low/Medium/High),
  Estimated Audience Size, Competitor Count.
- Use realistic USD price ranges typical of AliExpress vs Amazon.
- Above each table use an <h2> heading numbered like "1. Product Name".
- Add a short 2-3 sentence "Why it sells" paragraph under each table.

Return JSON with EXACTLY these fields:
{
  "title": "60-char max, includes keyword, click-worthy (e.g. 'Top Trending ... Products for Dropshipping in 2026')",
  "slug": "kebab-case-slug",
  "excerpt": "150 char meta description style",
  "content": "1100-1500 word HTML article. Intro paragraph, then 5 numbered products each with the <table class='product-table'> + Why-it-sells. No closing CTA — promo is appended automatically.",
  "meta_title": "60-char SEO title",
  "meta_description": "155-char meta description",
  "tags": ["tag1","tag2","tag3"],
  "seo_keywords": ["primary keyword","secondary","long-tail"],
  "image_prompt": "one-sentence visual description for a hero cover image matching the article topic"
}`;

  try {
    let finalPrompt = prompt;
    try {
      const memory = await loadSharedAgentMemory({ scope: "blog" });
      finalPrompt += buildSharedLearningBlock(memory);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[blog-ai] shared memory fetch failed, continuing without:", message);
    }
    const post = await callAiJson(finalPrompt);
    primaryKeyword = Array.isArray(post.seo_keywords) ? (post.seo_keywords[0] ?? null) : null;
    const slugBase = post.slug ? slugify(post.slug) : slugify(post.title || "post");
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const imagePrompt: string =
      post.image_prompt || `${post.title || primaryKeyword || niche} — modern lifestyle photo`;
    const featured_image_url = await generateAndUploadImage(imagePrompt, slugBase);

    const BRAND_PROMO_HTML = `
<section class="ar-brand-promo" style="margin-top:3rem;padding:2rem;border-radius:14px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;">
  <h2 style="color:#fff;margin-top:0;">Why AR Prime Market is the Ultimate Destination for Sourcing & Dropshipping These Trends</h2>
  <p>If you're serious about scaling a winning dropshipping store with products like the ones above, <strong>AR Prime Market</strong> is built end-to-end to give you the unfair advantage:</p>
  <ul style="line-height:1.9;">
    <li><strong>⚡ Lightning-Fast 1-Click Checkout</strong> — frictionless conversion that turns blog traffic into paying customers in seconds.</li>
    <li><strong>🔗 Automated Sourcing API</strong> — direct integrations with top-tier global suppliers so inventory, pricing & fulfillment stay in sync automatically.</li>
    <li><strong>💰 Unbeatable Wholesale Margins</strong> — true wholesale pricing with <em>zero hidden fees</em>, so every order keeps the profit margin you saw in the tables above.</li>
    <li><strong>🌍 Global Shipping Network</strong> — fast delivery to USA, UK, EU, UAE, Canada, AU and beyond.</li>
    <li><strong>📈 Built-in SEO & Marketing Engine</strong> — auto-generated product pages, schema, and blog content already ranking for buyer-intent keywords.</li>
  </ul>
  <p style="margin-top:1.25rem;text-align:center;">
    <a href="https://arprimemarket.shop" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#0b1220;font-weight:700;border-radius:10px;text-decoration:none;font-size:1.05rem;">🚀 Start Sourcing on AR Prime Market →</a>
  </p>
  <p style="text-align:center;font-size:.9rem;opacity:.85;margin-top:1rem;">
    Questions? <a href="https://arprimemarket.shop/contact" style="color:#7dd3fc;">Talk to our sourcing team →</a>
  </p>
</section>`;

    const fullContent = `${post.content || ""}\n${BRAND_PROMO_HTML}`;

    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .insert({
        title: post.title,
        slug,
        content: fullContent,
        excerpt: post.excerpt,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        tags: post.tags ?? [],
        seo_keywords: post.seo_keywords ?? [],
        author_name: "AR Prime Market",
        is_published: autoPublish,
        published_at: autoPublish ? new Date().toISOString() : null,
        featured_image_url,
      })
      .select("id, slug, title")
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("blog_generation_logs").insert({
      status: "success",
      triggered_by: triggeredBy,
      keyword: primaryKeyword,
      post_id: data.id,
      post_title: data.title,
      post_slug: data.slug,
      duration_ms: Date.now() - startedAt,
    });

    return { ok: true, post: data, niche, region, featured_image_url };
  } catch (e: unknown) {
    await supabaseAdmin.from("blog_generation_logs").insert({
      status: "failed",
      triggered_by: triggeredBy,
      keyword: primaryKeyword,
      error_message: ((e instanceof Error ? e.message : String(e)) || String(e)).slice(0, 2000),
      duration_ms: Date.now() - startedAt,
    });
    throw e;
  }
}
