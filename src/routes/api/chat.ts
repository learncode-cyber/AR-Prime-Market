import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { geminiProvider, isGeminiConfigured } from "@/lib/gemini.server";
import { loadSharedAgentMemory, buildSharedLearningBlock } from "@/lib/ai-memory";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = { messages?: unknown; threadId?: string };

const SYSTEM_PROMPT = `You are "Raiyan AI" — a friendly shopping assistant for AR Prime Market, a Bangladeshi e-commerce store (currency: BDT ৳).
You help customers discover products from our catalog.

GUIDELINES:
- Reply in the same language the user writes (Bengali or English). Default to Bengali.
- Use BDT ৳ for prices. Be concise, warm, helpful.
- Never invent products that did not come back from a tool.

TOOL USAGE (call automatically — do NOT ask permission):
- For product questions / recommendations / category browsing → call "search_products".
- If the user uploads an IMAGE → first describe what product type/color/style you see in 3-6 words, then call "search_products" with that as the query to find visually similar items.
- If the user message contains an order number (formats: ORD-YYYYMMDD-XXXXXXXXXX or ARP-XXXXXXXX-XXXXXX, case-insensitive) → call "track_order" with that exact number and present the timeline.
`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        if (!(await isGeminiConfigured("chat")))
          return new Response("Gemini API key not configured", { status: 500 });

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const threadId = body.threadId;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        const { data: thread } = await supabase
          .from("ai_chat_threads")
          .select("id")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const model = await geminiProvider(undefined, "chat");

        // Module 4 (Shared AI Memory): pull the same locked, cross-agent
        // learnings the CHRO orchestrator uses, so Raiyan AI doesn't
        // contradict company-wide facts it has no way of knowing otherwise.
        // Additive only — never overrides the guidelines above (e.g. the
        // BDT currency instruction is left as-is; see
        // docs/architecture/SHARED_AI_MEMORY.md for why that's flagged
        // rather than silently changed).
        let systemPrompt = SYSTEM_PROMPT;
        try {
          const memory = await loadSharedAgentMemory({ scope: "chat" });
          systemPrompt += buildSharedLearningBlock(memory);
        } catch (e) {
          console.error("[chat shared-memory]", e);
          // Non-fatal — the assistant still works fine on its base prompt.
        }

        const tools = {
          search_products: tool({
            description:
              "Search the AR Prime Market product catalog. Use whenever the user asks for product suggestions, by name, category, price range, or after analyzing an uploaded image.",
            inputSchema: z.object({
              query: z
                .string()
                .describe("Free-text search across title and description")
                .optional(),
              max_price: z.number().positive().optional(),
              min_price: z.number().nonnegative().optional(),
              limit: z.number().int().min(1).max(8).default(6),
            }),
            execute: async ({ query, max_price, min_price, limit }) => {
              let q = supabase
                .from("products")
                .select(
                  "id, title, slug, price, compare_at_price, gallery_urls, rating, review_count",
                )
                .eq("is_active", true)
                .order("rating", { ascending: false })
                .limit(limit ?? 6);
              if (query && query.trim().length > 0) {
                const safe = query.replace(/[,()]/g, " ").trim();
                q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
              }
              if (typeof max_price === "number") q = q.lte("price", max_price);
              if (typeof min_price === "number") q = q.gte("price", min_price);
              const { data, error } = await q;
              if (error) return { products: [], error: error.message };
              return {
                products: (data ?? []).map((p) => ({
                  id: p.id,
                  title: p.title,
                  slug: p.slug,
                  price: Number(p.price),
                  compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
                  image: (p.gallery_urls ?? [])[0] ?? null,
                  rating: Number(p.rating ?? 0),
                  review_count: p.review_count ?? 0,
                })),
              };
            },
          }),

          track_order: tool({
            description:
              "Look up the live status of an order by its order number (formats: ORD-YYYYMMDD-XXXXXXXXXX or ARP-XXXXXXXX-XXXXXX). Returns the current status and a timeline.",
            inputSchema: z.object({
              order_number: z.string().min(4).max(64),
            }),
            execute: async ({ order_number }) => {
              const num = order_number.trim().toUpperCase();
              const { data: order, error } = await supabase
                .from("orders")
                .select(
                  "id, order_number, status, payment_status, total_amount, currency, created_at, updated_at, user_id, guest_token",
                )
                .ilike("order_number", num)
                .maybeSingle();
              if (error) return { found: false, error: error.message };
              if (!order) return { found: false, order_number: num };

              // Only allow viewing own orders (RLS enforces too, but be explicit)
              if (order.user_id && order.user_id !== userId) {
                return { found: false, order_number: num };
              }

              const status = (order.status ?? "pending") as string;
              const flow = ["pending", "processing", "shipped", "delivered"];
              const cancelled = status === "cancelled" || status === "refunded";
              const idx = cancelled ? -1 : Math.max(0, flow.indexOf(status));
              const timeline = flow.map((s, i) => ({
                key: s,
                label:
                  s === "pending"
                    ? "Order Placed"
                    : s === "processing"
                      ? "Processing"
                      : s === "shipped"
                        ? "Shipped"
                        : "Delivered",
                done: !cancelled && i <= idx,
                current: !cancelled && i === idx,
              }));

              return {
                found: true,
                order: {
                  order_number: order.order_number,
                  status,
                  payment_status: order.payment_status,
                  total: Number(order.total_amount ?? 0),
                  currency: order.currency ?? "BDT",
                  placed_at: order.created_at,
                  updated_at: order.updated_at,
                  cancelled,
                },
                timeline,
              };
            },
          }),
        };

        const uiMessages = messages as UIMessage[];

        const result = streamText({
          model,
          system: systemPrompt,
          tools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              const last = finalMessages.slice(-2);
              const rows = last.map((m) => ({
                thread_id: threadId,
                user_id: userId,
                role: m.role,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                parts: m.parts as any,
              }));
              if (rows.length > 0) {
                const { error: insErr } = await supabase.from("ai_chat_messages").insert(rows);
                if (insErr) console.error("[chat persist]", insErr.message);
              }
              const firstUser = uiMessages.find((m) => m.role === "user");
              const titleText = firstUser
                ? firstUser.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join(" ")
                    .trim()
                    .slice(0, 60)
                : "";
              const updates: { updated_at: string; title?: string } = {
                updated_at: new Date().toISOString(),
              };
              const { data: t } = await supabase
                .from("ai_chat_threads")
                .select("title")
                .eq("id", threadId)
                .maybeSingle();
              if (t?.title === "New chat" && titleText.length > 0) {
                updates.title = titleText;
              }
              await supabase.from("ai_chat_threads").update(updates).eq("id", threadId);
            } catch (e) {
              console.error("[chat onFinish]", e);
            }
          },
        });
      },
    },
  },
});
