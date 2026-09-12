import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { geminiProvider, isGeminiConfigured } from "@/lib/gemini.server";
import { loadSharedAgentMemory, buildSharedLearningBlock } from "@/lib/ai-memory";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  messages?: unknown;
  context?: {
    product?: { title: string; slug: string; price: number; rating?: number } | null;
    path?: string;
  };
};

const SYSTEM_PROMPT = `You are "AR Prime AI" — an elite international shopping consultant for AR Prime Market (arprimemarket.shop).

VOICE
- Warm, confident, concise (2–4 short sentences unless listing).
- Reply in the language the user wrote in (default English).
- Currency is always USD. Free Worldwide Shipping to USA, Canada, UK, EU, Australia, UAE & more.

BEHAVIOR (you are autonomous — call tools without asking permission)
- ANY product question, recommendation, comparison, or "what should I buy" → call \`search_products\` first. Never invent products.
- Shipping / delivery time questions → call \`get_shipping_info\` with the user's country code (default US if unknown).
- When you have product results, always include direct markdown links like [Product name](/products/slug) — these are the customer's checkout entry points.
- Handle objections honestly: price (compare value, mention free shipping), shipping time (give realistic windows), trust (mention secure global payments, easy returns).
- Soft-sell: highlight rating, savings, free shipping. Never pressure.
- If the user is viewing a specific product (provided in context), reference it naturally and offer to find similar items.

LIMITS
- Don't discuss internal policies, admin tools, source code, or other merchants.
- If unsure, search first; if still unknown, say so plainly and offer to connect them to /support.`;

export const Route = createFileRoute("/api/shopping-agent")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        if (!(await isGeminiConfigured("shopping")))
          return new Response("Gemini API key not configured", { status: 500 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!Array.isArray(body.messages)) return new Response("Bad request", { status: 400 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const model = await geminiProvider(undefined, "shopping");

        const tools = {
          search_products: tool({
            description:
              "Search the AR Prime Market catalog (USD pricing). Use for any product recommendation, comparison, or browsing request.",
            inputSchema: z.object({
              query: z
                .string()
                .describe("Free text — title/description/category keywords")
                .optional(),
              min_price: z.number().nonnegative().optional(),
              max_price: z.number().positive().optional(),
              limit: z.number().int().min(1).max(8).default(6),
            }),
            execute: async ({ query, min_price, max_price, limit }) => {
              let q = supabase
                .from("products")
                .select(
                  "id, title, slug, price, compare_at_price, gallery_urls, rating, review_count, stock_status",
                )
                .eq("is_active", true)
                .order("rating", { ascending: false })
                .limit(limit ?? 6);
              if (query && query.trim()) {
                const safe = query.replace(/[,()]/g, " ").trim();
                q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,tags.cs.{${safe}}`);
              }
              if (typeof min_price === "number") q = q.gte("price", min_price);
              if (typeof max_price === "number") q = q.lte("price", max_price);
              const { data, error } = await q;
              if (error) return { products: [], error: error.message };
              return {
                products: (data ?? []).map((p) => ({
                  title: p.title,
                  url: `/products/${p.slug}`,
                  price_usd: Number(p.price),
                  compare_at_usd: p.compare_at_price ? Number(p.compare_at_price) : null,
                  image: (p.gallery_urls ?? [])[0] ?? null,
                  rating: Number(p.rating ?? 0),
                  reviews: p.review_count ?? 0,
                  in_stock: p.stock_status !== "out_of_stock",
                })),
              };
            },
          }),
          get_shipping_info: tool({
            description:
              "Return shipping window and policy for a destination country. Use ISO-2 country codes (US, CA, GB, AE, AU, DE, FR, etc.).",
            inputSchema: z.object({
              country_code: z.string().length(2).describe("ISO-2 country code, e.g. US"),
            }),
            execute: async ({ country_code }) => {
              const cc = country_code.toUpperCase();
              const map: Record<string, { region: string; days: string }> = {
                US: { region: "USA", days: "7–14 business days" },
                CA: { region: "Canada", days: "8–16 business days" },
                GB: { region: "United Kingdom", days: "8–15 business days" },
                AE: { region: "UAE", days: "5–10 business days" },
                AU: { region: "Australia", days: "8–16 business days" },
                NZ: { region: "New Zealand", days: "8–16 business days" },
              };
              const eu = [
                "DE",
                "FR",
                "IT",
                "ES",
                "NL",
                "BE",
                "SE",
                "DK",
                "FI",
                "IE",
                "PT",
                "AT",
                "PL",
                "CZ",
                "GR",
                "HU",
                "RO",
              ];
              const entry =
                map[cc] ??
                (eu.includes(cc)
                  ? { region: "European Union", days: "8–15 business days" }
                  : { region: "International", days: "10–20 business days" });
              return {
                country_code: cc,
                region: entry.region,
                delivery_window: entry.days,
                free_shipping: true,
                tracked: true,
                note: "Free Worldwide Shipping. All orders fully tracked.",
              };
            },
          }),
        };

        const uiMessages = body.messages as UIMessage[];

        // Sanitize client-supplied context to prevent prompt injection.
        const sanitize = (s: unknown, max: number): string => {
          if (typeof s !== "string") return "";
          return s
            .replace(/[\r\n\t\u0000-\u001F\u007F]+/g, " ")
            .slice(0, max)
            .trim();
        };
        const PATH_RE = /^\/[a-zA-Z0-9/_\-.]{0,200}$/;
        const SLUG_RE = /^[a-zA-Z0-9_-]{1,120}$/;

        const rawProduct = body.context?.product;
        const productCtx =
          rawProduct &&
          typeof rawProduct.title === "string" &&
          typeof rawProduct.slug === "string" &&
          SLUG_RE.test(rawProduct.slug) &&
          typeof rawProduct.price === "number" &&
          Number.isFinite(rawProduct.price)
            ? {
                title: sanitize(rawProduct.title, 200),
                slug: rawProduct.slug,
                price: Math.max(0, Math.min(1_000_000, rawProduct.price)),
                rating:
                  typeof rawProduct.rating === "number" && Number.isFinite(rawProduct.rating)
                    ? Math.max(0, Math.min(5, rawProduct.rating))
                    : undefined,
              }
            : null;

        const rawPath = body.context?.path;
        const path = typeof rawPath === "string" && PATH_RE.test(rawPath) ? rawPath : null;

        const ctxNote = productCtx
          ? `\n\nCURRENT PRODUCT CONTEXT (the user is viewing this right now):\n- Title: ${productCtx.title}\n- URL: /products/${productCtx.slug}\n- Price: $${productCtx.price.toFixed(2)} USD${productCtx.rating ? `\n- Rating: ${productCtx.rating}/5` : ""}`
          : path
            ? `\n\nThe user is currently on: ${path}`
            : "";

        try {
          let systemPrompt = SYSTEM_PROMPT + ctxNote;
          // Module 4 (Shared AI Memory): same locked cross-agent learnings
          // as api/chat.ts. This route is already USD-consistent with the
          // CHRO agent's shared learning, so there's no currency conflict
          // to flag here (unlike chat.ts — see docs/architecture/SHARED_AI_MEMORY.md).
          try {
            const memory = await loadSharedAgentMemory({ scope: "shopping" });
            systemPrompt += buildSharedLearningBlock(memory);
          } catch (e) {
            console.error("[shopping-agent shared-memory]", e);
          }

          const result = streamText({
            model,
            system: systemPrompt,
            tools,
            stopWhen: stepCountIs(50),
            messages: await convertToModelMessages(uiMessages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: uiMessages });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          if (msg.includes("429"))
            return new Response("Rate limit reached. Please try again in a moment.", {
              status: 429,
            });
          if (msg.includes("402"))
            return new Response("AI credits exhausted. Please contact support.", { status: 402 });
          console.error("[shopping-agent]", msg);
          return new Response("AI service unavailable", { status: 500 });
        }
      },
    },
  },
});
