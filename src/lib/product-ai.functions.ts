import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { geminiProvider, isGeminiConfigured } from "@/lib/gemini.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  seedTitle: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  priceUSD: z.number().min(0).max(100000).optional(),
  imageUrl: z.string().url().max(2000).optional(),
});

// Keep schema loose — Gemini's constrained decoder rejects narrow
// min/max length bounds and fails with AI_NoObjectGeneratedError.
// We enforce final shape after generation.
const OutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  tags: z.array(z.string()),
});

const FinalSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(20).max(1200),
  metaTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(40).max(160),
  tags: z.array(z.string().min(1).max(30)).min(3).max(10),
});

function clamp(s: string, min: number, max: number, pad = "") {
  let out = s.trim();
  if (out.length > max) out = out.slice(0, max).trim();
  if (out.length < min && pad) out = (out + " " + pad).slice(0, max).trim();
  return out;
}

export const generateProductContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    if (!(await isGeminiConfigured("product"))) {
      throw new Error("AI is not configured. Set a Gemini API key in Admin Panel -> API Keys.");
    }

    const model = await geminiProvider(undefined, "product");

    const promptContext = [
      data.seedTitle ? `Seed title: ${data.seedTitle}` : "",
      data.category ? `Category: ${data.category}` : "",
      data.priceUSD != null ? `Price: $${data.priceUSD.toFixed(2)} USD` : "",
      data.imageUrl ? `Image: ${data.imageUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system = [
      "You are an expert e-commerce SEO copywriter for an international dropshipping store.",
      "Target markets: USA, Canada, UK, EU, Australia, UAE. Prices are in USD.",
      "Write polished, persuasive, benefit-led copy in English.",
      "Never mention Bangladesh, Dhaka, BDT, or Taka in any output.",
      "Constraints: title 3-120 chars; description 20-1200 chars; metaTitle 10-70 chars;",
      "metaDescription 40-160 chars; 3-10 lowercase tags (1-2 words, no '#').",
    ].join(" ");

    const { experimental_output } = await generateText({
      model,
      system,
      prompt: `Generate product listing content based on:\n${promptContext || "(no context — invent a generic premium consumer product)"}`,
      experimental_output: Output.object({ schema: OutputSchema }),
    });

    const raw = experimental_output;
    const normalized = {
      title: clamp(raw.title || "Untitled Product", 3, 120),
      description: clamp(
        raw.description || "",
        20,
        1200,
        "Premium quality product designed for everyday use.",
      ),
      metaTitle: clamp(raw.metaTitle || raw.title || "", 10, 70, "Premium Product"),
      metaDescription: clamp(
        raw.metaDescription || raw.description || "",
        40,
        160,
        "Discover our premium product — quality you can trust, shipped worldwide.",
      ),
      tags: (raw.tags || [])
        .map((t) => t.toLowerCase().replace(/^#/, "").trim())
        .filter(Boolean)
        .slice(0, 10),
    };
    while (normalized.tags.length < 3)
      normalized.tags.push(["new", "popular", "trending"][normalized.tags.length]);

    return FinalSchema.parse(normalized);
  });
