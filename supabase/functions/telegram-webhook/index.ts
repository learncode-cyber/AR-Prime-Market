// Edge Function: telegram-webhook
// Two-way AI CEO Control Panel via personal DM with the bot.
// - Only responds to PRIVATE chats (DMs), ignores groups & channels
// - Restricted to admin user IDs (TELEGRAM_ADMIN_USER_IDS)
// - Verifies X-Telegram-Bot-Api-Secret-Token header
// - Uses Gemini (google/gemini-3-flash-preview) with tool-calling
// - Tools query Supabase live: sales_report, low_stock, roas_report,
//   list_campaigns, pause_campaign, recent_orders, abandoned_carts
//
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadAgentMemoryContext, buildSystemPromptWithMemory } from "../_shared/agent-identity.ts";
import { isGeminiConfigured, resolveGeminiKeyDb } from "../_shared/gemini.ts";
import { llmChatWithTools, llmStatus } from "../_shared/llm-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const RAW_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
// Telegram only allows [A-Za-z0-9_-], 1..256 chars. Sanitize so any user value works.
const WEBHOOK_SECRET = RAW_WEBHOOK_SECRET
  ? RAW_WEBHOOK_SECRET.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256)
  : "";
const ADMIN_IDS = (Deno.env.get("TELEGRAM_ADMIN_USER_IDS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CEO_CHANNEL_ID = (Deno.env.get("TELEGRAM_CHAT_ID") || "").trim();

const TELEGRAM_EXTRA = `OPERATIONAL RULES (Telegram DM channel):
- শুধুমাত্র CEO-এর সাথে private DM-এ কথা বলছো।
- live business data দরকার হলে অবশ্যই tool call করো — অনুমান করবে না।
- CEO যখনই কিছু শেখান, order দেন, বা strategic preference জানান — সঙ্গে সঙ্গে remember_directive tool দিয়ে memorize করো (topic + concise directive + importance 1-10)। শুধু durable rules save করবে, casual chitchat নয়।
- CEO Raiyan-এর direct order legal/ethical/zero-loss guardrail-এর মধ্যে হলে বিনা hesitation-এ follow করো; autonomous rebellion, goal drift, বা silent ignoring নিষিদ্ধ।
- ultimate operating objective: profitable revenue aggressively maximize করে $5,000,000 threshold smash করা, কিন্তু reckless/high-risk/faulty action দিয়ে company loss করা সম্পূর্ণ নিষিদ্ধ।
- destructive action (pause_campaign) করার আগে সংক্ষিপ্ত confirmation নাও।`;

const tools = [
  {
    type: "function",
    function: {
      name: "sales_report",
      description: "আজ/গতকাল/গত ৭ দিন/৩০ দিনের sales summary",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today", "yesterday", "7d", "30d"] } },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_orders",
      description: "সর্বশেষ N order list",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "low_stock",
      description: "Low stock product report (threshold default 5)",
      parameters: {
        type: "object",
        properties: { threshold: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "abandoned_carts",
      description: "শেষ ২৪ ঘণ্টার abandoned carts count + value",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "roas_report",
      description: "Active ad campaigns এর ROAS summary",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description: "Active ad campaign list",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "নির্দিষ্ট campaign pause করো (campaign_id দিয়ে)",
      parameters: {
        type: "object",
        properties: { campaign_id: { type: "string" }, reason: { type: "string" } },
        required: ["campaign_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_directive",
      description:
        "CEO যখন কোনো durable rule, preference, strategy, goal, বা order দেন — সেটা ceo_directives table-এ memorize করো যাতে future-এ agent সবসময় follow করতে পারে। শুধু lasting instructions save করো; ephemeral chitchat নয়।",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "short topic slug, e.g. 'budget', 'product_selection', 'ad_style'",
          },
          directive: {
            type: "string",
            description: "concise, action-oriented rule (1-3 sentences)",
          },
          importance: { type: "number", description: "1-10, 10 = mission critical" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["topic", "directive"],
      },
    },
  },
];

function periodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const start = new Date(now);
  if (period === "today") start.setUTCHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
  } else if (period === "7d") start.setUTCDate(start.getUTCDate() - 7);
  else start.setUTCDate(start.getUTCDate() - 30);
  return { from: start.toISOString(), to };
}

async function runTool(admin, name: string, args: any) {
  try {
    if (name === "sales_report") {
      const { from, to } = periodRange(args.period || "today");
      const { data } = await admin
        .from("orders")
        .select("total_amount,status,payment_status")
        .gte("created_at", from)
        .lte("created_at", to);
      const rows = data || [];
      const revenue = rows
        .filter((o) => o.payment_status !== "refunded" && o.status !== "cancelled")
        .reduce((s, o) => s + Number(o.total_amount || 0), 0);
      return { period: args.period, orders: rows.length, revenue_usd: revenue.toFixed(2) };
    }
    if (name === "recent_orders") {
      const { data } = await admin
        .from("orders")
        .select("order_number,total_amount,status,payment_status,created_at,customer_name")
        .order("created_at", { ascending: false })
        .limit(Math.min(args.limit || 5, 20));
      return { orders: data || [] };
    }
    if (name === "low_stock") {
      const t = args.threshold || 5;
      const { data } = await admin
        .from("products")
        .select("title,stock_quantity,price")
        .lte("stock_quantity", t)
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true })
        .limit(20);
      return { threshold: t, products: data || [] };
    }
    if (name === "abandoned_carts") {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await admin
        .from("abandoned_carts")
        .select("cart_value,recovered")
        .gte("created_at", since);
      if (error) return { error: error.message };
      const rows = data || [];
      const open = rows.filter((c) => !c.recovered);
      return {
        total: rows.length,
        open: open.length,
        value_usd: open.reduce((s, c) => s + Number(c.cart_value || 0), 0).toFixed(2),
      };
    }
    if (name === "list_campaigns" || name === "roas_report") {
      const { data, error } = await admin
        .from("ad_campaigns")
        .select("id,name,platform,status,daily_budget,spend,revenue,roas")
        .eq("status", "active")
        .order("spend", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      return { campaigns: data || [] };
    }
    if (name === "pause_campaign") {
      const { error } = await admin
        .from("ad_campaigns")
        .update({
          status: "paused",
          paused_at: new Date().toISOString(),
          pause_reason: args.reason || "CEO via Telegram",
        })
        .eq("id", args.campaign_id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, paused: args.campaign_id };
    }
    if (name === "remember_directive") {
      const topic = String(args.topic || "general").slice(0, 80);
      const directive = String(args.directive || "")
        .trim()
        .slice(0, 1200);
      if (!directive) return { ok: false, error: "empty_directive" };
      const importance = Math.min(10, Math.max(1, Number(args.importance ?? 5)));
      const tags = Array.isArray(args.tags)
        ? args.tags.slice(0, 8).map((t: unknown) => String(t).slice(0, 40))
        : [];
      const { error } = await admin.from("ceo_directives").insert({
        source: "telegram",
        topic,
        directive,
        importance,
        tags,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, memorized: { topic, importance, tags } };
    }
  } catch (e) {
    return { error: String(e) };
  }
  return { error: "unknown_tool" };
}

async function callGateway(messages: any[]) {
  const st = await llmStatus();
  if (!st.anthropic && !st.gemini)
    throw new Error(
      "No LLM provider configured (set a Gemini key in Admin Panel -> API Keys, or set ANTHROPIC_API_KEY / GEMINI_API_KEY)",
    );
  const result = await llmChatWithTools({ messages, tools, surface: "telegram", agent: "ceo" });
  // Shape it like the previous OpenAI-compatible response for the existing loop.
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: result.content,
          tool_calls: result.tool_calls,
        },
      },
    ],
  };
}

function escapeHtmlSafe(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizePersonaText(input: unknown): string {
  return String(input ?? "")
    .replace(/\b1st CEO Raiyan\b/gi, "CEO Raiyan")
    .replace(/\bFirst CEO Raiyan\b/gi, "CEO Raiyan")
    .replace(/\b1st CEO\b/gi, "CEO")
    .replace(/\bFirst CEO\b/gi, "CEO")
    .replace(/operational scope(?: limit)?/gi, "dynamic CEO-approved operating context");
}

async function sendTg(chatId: number, text: string, replyTo?: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      parse_mode: "HTML",
      reply_to_message_id: replyTo,
      disable_web_page_preview: true,
    }),
  }).catch((e) => console.error("[tg send]", e));
}

async function sendChatAction(chatId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

async function persistTelegramTurn(
  admin,
  userId: string,
  role: "user" | "assistant",
  content: string,
) {
  if (!userId || !content.trim()) return false;
  const { error } = await admin.from("telegram_chat_history").insert({
    user_id: userId,
    role,
    content: content.trim().slice(0, 8000),
  });
  if (error) {
    console.error("[webhook] telegram_chat_history insert failed", error.message);
    return false;
  }
  return true;
}

async function upsertTelegramSessionMemory(admin, msg: any, text: string, finalReply?: string) {
  const userId = String(msg.from?.id ?? msg.sender_chat?.id ?? msg.chat?.id ?? "");
  if (!userId) return;
  const now = new Date().toISOString();
  const key = `telegram:session:${userId}`;
  const { error } = await admin.from("agent_memory").upsert(
    {
      memory_type: "telegram_session",
      key,
      value: {
        user_id: userId,
        chat_id: String(msg.chat?.id ?? ""),
        username: msg.from?.username ?? null,
        first_name: msg.from?.first_name ?? null,
        last_name: msg.from?.last_name ?? null,
        last_user_message: text.slice(0, 4000),
        last_assistant_reply: finalReply ? finalReply.slice(0, 4000) : undefined,
        last_message_at: now,
        source: "telegram-webhook",
      },
      confidence: 0.95,
      source: "telegram-webhook",
      last_updated: now,
    },
    { onConflict: "key" },
  );
  if (error) console.error("[webhook] agent_memory upsert failed", error.message);
}

// ============ Intelligent Response Cache ============
// In-memory 60s TTL cache for structural Telegram replies (/agents, /agents_health).
// Skips the Gemini API completely AND skips repeated DB roundtrips when state is unchanged.
const respCache = new Map<string, { rendered: string; stateHash: string; expiresAt: number }>();
const RESP_CACHE_TTL_MS = 60_000;

async function hashState(input: unknown): Promise<string> {
  const data = new TextEncoder().encode(typeof input === "string" ? input : JSON.stringify(input));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function getCachedRender(
  key: string,
  fetchState: () => Promise<{ state: unknown; render: (s: any) => string }>,
): Promise<string> {
  const now = Date.now();
  const mem = respCache.get(key);
  if (mem && mem.expiresAt > now) return mem.rendered;
  const { state, render } = await fetchState();
  const stateHash = await hashState(state);
  if (mem && mem.stateHash === stateHash) {
    mem.expiresAt = now + RESP_CACHE_TTL_MS;
    return mem.rendered;
  }
  const rendered = render(state);
  respCache.set(key, { rendered, stateHash, expiresAt: now + RESP_CACHE_TTL_MS });
  return rendered;
}

// ============ Telegram file attachment ingestion ============
async function downloadTelegramFile(
  fileId: string,
): Promise<{ bytes: Uint8Array; path: string } | null> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const j = await r.json();
    const filePath = j?.result?.file_path;
    if (!filePath) return null;
    const dl = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    const buf = new Uint8Array(await dl.arrayBuffer());
    return { bytes: buf, path: filePath };
  } catch (e) {
    console.error("[telegram file dl]", e);
    return null;
  }
}

// Convert Uint8Array → base64 (chunked to avoid stack overflow on large images)
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Vision analysis via Claude 3.5 Sonnet (Anthropic) with Gemini fallback.
async function analyzeImageWithVision(opts: {
  bytes: Uint8Array;
  mime: string;
  prompt: string;
  systemPrompt: string;
}): Promise<string> {
  const anthKey = Deno.env.get("ANTHROPIC_API_KEY");
  const base64 = bytesToBase64(opts.bytes);
  const mediaType = /^image\/(jpeg|png|gif|webp)$/i.test(opts.mime) ? opts.mime : "image/jpeg";

  if (anthKey) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 1500,
        system: opts.systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text:
                  opts.prompt ||
                  "এই ছবিটি বিশ্লেষণ করো — product, demand potential, target market, এবং dropshipping fit সম্পর্কে concise executive summary দাও।",
              },
            ],
          },
        ],
      }),
    });
    if (r.ok) {
      const j = await r.json();
      const txt = (j?.content ?? [])
        .map((p: any) => p?.text ?? "")
        .join("")
        .trim();
      if (txt) return txt;
    } else {
      console.warn("[vision anthropic]", r.status, (await r.text()).slice(0, 300));
    }
  }

  let geminiKey: string | null = null;
  try {
    geminiKey = await resolveGeminiKeyDb();
  } catch {
    geminiKey = null;
  }
  if (geminiKey) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: mediaType, data: base64 } },
                {
                  text:
                    opts.prompt ||
                    "এই ছবিটি বিশ্লেষণ করো — product demand, target market, dropshipping fit।",
                },
              ],
            },
          ],
        }),
      },
    );
    if (r.ok) {
      const j = await r.json();
      const txt = (j?.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p?.text ?? "")
        .join("")
        .trim();
      if (txt) return txt;
    } else {
      console.warn("[vision gemini]", r.status, (await r.text()).slice(0, 300));
    }
  }
  throw new Error("No vision-capable model configured");
}

function looksLikeText(bytes: Uint8Array, mime?: string): boolean {
  if (mime && /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|x-sh))/i.test(mime))
    return true;
  const slice = bytes.slice(0, 2048);
  let bad = 0;
  for (const b of slice) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) bad++;
  }
  return bad / Math.max(1, slice.length) < 0.05;
}

async function ingestAttachment(admin, msg: any, userId: string, chatId: number, text: string) {
  const doc = msg.document;
  const photoArr = Array.isArray(msg.photo) ? msg.photo[msg.photo.length - 1] : null;
  // Treat document with image/* mime as a photo so vision pipeline runs even when
  // the user sends an uncompressed image as a "file" attachment.
  const docIsImage = !!(doc?.mime_type && /^image\//i.test(doc.mime_type));
  const photo = photoArr || (docIsImage ? doc : null);
  const file = doc || photoArr;
  if (!file?.file_id) return null;

  // Parse target sub-agent + task from caption: "/dev apply this file: refactor X"
  const caption = String(msg.caption || text || "").trim();
  const cmdMatch = caption.match(/^\/([a-z0-9_]{2,32})\s*(.*)$/i);
  const targetAgent = cmdMatch ? cmdMatch[1].toLowerCase() : null;
  const taskBody = cmdMatch ? cmdMatch[2].trim() : caption;

  await sendTg(
    chatId,
    `📥 Receiving file <code>${escapeHtmlSafe(doc?.file_name || "image")}</code>${targetAgent ? ` → routing to <b>/${targetAgent}</b>` : ""}...`,
  );

  const dl = await downloadTelegramFile(file.file_id);
  if (!dl) {
    await sendTg(chatId, "⚠️ File download failed।");
    return null;
  }
  const mime = doc?.mime_type || (photoArr ? "image/jpeg" : "application/octet-stream");
  const fileName =
    doc?.file_name || `tg-${file.file_id.slice(0, 8)}.${mime.split("/")[1] || "bin"}`;
  const isText = looksLikeText(dl.bytes, mime);
  const preview = isText
    ? new TextDecoder().decode(dl.bytes.slice(0, 8000))
    : `(binary ${dl.bytes.length} bytes, ${mime})`;

  // Stage in storage bucket (product-images is the only writable shared bucket; use a /telegram/ prefix)
  const storagePath = `telegram-ingest/${userId}/${Date.now()}-${fileName}`;
  try {
    await admin.storage.from("product-images").upload(storagePath, dl.bytes, {
      contentType: mime,
      upsert: false,
    });
  } catch (e) {
    console.error("[telegram ingest storage]", e);
  }

  const { data: row } = await admin
    .from("telegram_file_ingest")
    .insert({
      user_id: userId,
      chat_id: String(chatId),
      target_agent: targetAgent,
      task: taskBody.slice(0, 2000),
      file_id: file.file_id,
      file_name: fileName,
      mime_type: mime,
      size_bytes: dl.bytes.length,
      storage_path: storagePath,
      text_preview: preview.slice(0, 8000),
      status: "staged",
    })
    .select("id")
    .maybeSingle();

  // If targeted at a registered agent, route immediately via CHRO with file context attached.
  if (targetAgent) {
    let visionDesc = "";
    if (photo) {
      try {
        visionDesc = await analyzeImageWithVision({
          bytes: dl.bytes,
          mime,
          prompt: `User sent this image with task: "${taskBody}". Describe everything visible (UI, errors, text, product details) so a code/SWE agent can act without seeing the image.`,
          systemPrompt:
            "You are a vision assistant for a developer sub-agent. Output a precise, structured description.",
        });
      } catch (e) {
        console.warn("[vision for agent route]", e);
      }
    }
    const fileContext = isText
      ? `\n\n--- ATTACHED FILE: ${fileName} (${mime}, ${dl.bytes.length}b) ---\n${preview}\n--- END FILE ---`
      : visionDesc
        ? `\n\n--- ATTACHED IMAGE: ${fileName} (${mime}) ---\nVISION DESCRIPTION:\n${visionDesc}\n--- END IMAGE ---`
        : `\n\n[binary attachment: ${fileName} (${mime}, ${dl.bytes.length} bytes) staged at storage://product-images/${storagePath}]`;
    const fullTask = `${taskBody || "Process the attached file and propose a staging patch."}${fileContext}`;
    const out = await fetch(`${SUPABASE_URL}/functions/v1/chro-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({
        action: "invoke",
        agent: targetAgent,
        task: fullTask,
        requested_by: userId,
        source: "telegram-file",
      }),
    })
      .then((r) => r.json())
      .catch(() => ({ error: "orchestrator failed" }));

    if (out?.error) {
      await sendTg(chatId, `⚠️ /${targetAgent}: ${out.error}`);
    } else {
      if (row?.id) {
        await admin
          .from("telegram_file_ingest")
          .update({ status: "routed", proposal_id: out.proposal_id })
          .eq("id", row.id);
      }
      await sendTg(
        chatId,
        `📋 <b>Proposal #${out.proposal_id}</b> — ${out.agent?.display_name || targetAgent}\n` +
          `<i>File staged + analyzed. Raw payload hidden.</i>\n\n` +
          `<b>HIGH-LEVEL PLAN</b>\n<pre>${escapeHtmlSafe(out.plan_summary).slice(0, 3000)}</pre>\n\n` +
          `<code>/show ${out.proposal_id}</code> | <code>/approve ${out.proposal_id}</code> | <code>/reject ${out.proposal_id}</code>`,
      );
    }
  } else if (photo) {
    // No slash-command caption: run CEO-level vision analysis directly and reply.
    await sendChatAction(chatId);
    try {
      const memory = await loadAgentMemoryContext(admin, { scope: "telegram" });
      const sysPrompt = buildSystemPromptWithMemory(memory, TELEGRAM_EXTRA);
      const userPrompt =
        taskBody ||
        caption ||
        "এই ছবিটি দেখো এবং CEO-কে product demand, target market, dropshipping fit, এবং recommended action সম্পর্কে concise বাংলায় বিশ্লেষণ দাও।";
      const visionReply = await analyzeImageWithVision({
        bytes: dl.bytes,
        mime,
        prompt: userPrompt,
        systemPrompt: sysPrompt,
      });
      const finalReply = normalizePersonaText(visionReply);
      await sendTg(chatId, finalReply);
      // Persist vision description into chat memory so subsequent text turns retain image context.
      await persistTelegramTurn(
        admin,
        userId,
        "assistant",
        `[image analyzed: ${fileName}]\n${finalReply}`,
      );
      if (row?.id)
        await admin.from("telegram_file_ingest").update({ status: "analyzed" }).eq("id", row.id);
    } catch (e) {
      console.error("[vision reply]", e);
      await sendTg(chatId, `⚠️ Vision analysis failed: ${String(e).slice(0, 200)}`);
    }
  } else {
    await sendTg(
      chatId,
      `✅ File staged (id <code>${row?.id || "?"}</code>). Use a command like <code>/dev &lt;task&gt;</code> in the caption to route it to a sub-agent.`,
    );
  }
  return row?.id ?? null;
}

async function handleMessage(admin, msg: any, opts: { isChannel?: boolean } = {}) {
  const chatId = msg.chat.id;
  const isChannel = !!opts.isChannel;
  // For channel posts there is no msg.from; use a synthetic user id keyed by chat id.
  const userId = isChannel ? `channel:${chatId}` : String(msg.from?.id || "");
  const text = (msg.text || msg.caption || "").trim();

  if (isChannel) {
    // Only respond inside the configured CEO dashboard channel.
    if (!CEO_CHANNEL_ID || String(chatId) !== CEO_CHANNEL_ID) {
      console.log("[webhook] ignored channel post from", chatId);
      return;
    }
  } else {
    // Lock down: only private chats
    if (msg.chat.type !== "private") {
      console.log("[webhook] ignored non-private chat", msg.chat.type);
      return;
    }
    // Lock down: only admin user IDs
    if (ADMIN_IDS.length === 0 || !ADMIN_IDS.includes(userId)) {
      await sendTg(
        chatId,
        `⛔ Access denied.\nYour ID: <code>${userId}</code>\nAdd it to <b>TELEGRAM_ADMIN_USER_IDS</b> secret to unlock.`,
      );
      return;
    }
  }

  if (!text && !(msg.document || msg.photo)) return;

  // File attachment ingestion (document or photo) — staged + optionally routed to a sub-agent via caption command.
  if (msg.document || msg.photo) {
    await persistTelegramTurn(
      admin,
      userId,
      "user",
      `[file: ${msg.document?.file_name || "photo"}] ${text}`.slice(0, 1000),
    );
    await ingestAttachment(admin, msg, userId, chatId, text);
    return;
  }

  // Persist verified inbound message + refresh compact session memory.
  const inboundLogged = await persistTelegramTurn(admin, userId, "user", text);
  await upsertTelegramSessionMemory(admin, msg, text);

  // Commands
  if (text === "/start" || text === "/help") {
    const reply =
      `🤖 <b>AR Prime CEO Control Panel</b>\n\n` +
      `<b>📊 Business queries (natural language)</b>\n` +
      `• "আজকের sales কত?" • "low stock products" • "active campaigns"\n\n` +
      `<b>🧠 CHRO Sub-Agent Orchestration</b>\n` +
      `• /agents — registered sub-agents list\n` +
      `• /agent_create &lt;slug&gt; | &lt;display name&gt; | &lt;role focus&gt;\n` +
      `• /sec &lt;task&gt; — Security Expert\n` +
      `• /dev &lt;task&gt; — Dev/SWE Expert (frontend+backend code patches)\n` +
      `• /marketing &lt;task&gt; — Marketing Expert\n` +
      `• /growth &lt;task&gt; — Growth Hacker\n` +
      `• /ask &lt;slug&gt; &lt;task&gt; — any registered sub-agent\n` +
      `• /agents_health — last-24h activity per agent\n\n` +
      `<b>📋 Proposal Approval Pipeline (plan-only by default)</b>\n` +
      `• /pending — pending proposals + legacy security patches\n` +
      `• /show &lt;id&gt; — reveal full code/payload of a proposal\n` +
      `• /approve &lt;id&gt; [note] — approve + receive dev-ready instruction\n` +
      `• /reject &lt;id&gt; [note]\n` +
      `• /applied &lt;id&gt; [note] — mark as shipped\n\n` +
      `Other: /id /start /help`;
    await sendTg(chatId, reply);
    await persistTelegramTurn(admin, userId, "assistant", reply);
    await upsertTelegramSessionMemory(admin, msg, text, reply);
    return;
  }

  if (text === "/id") {
    const reply = `Your Telegram user ID: <code>${userId}</code>`;
    await sendTg(chatId, reply);
    await persistTelegramTurn(admin, userId, "assistant", reply);
    await upsertTelegramSessionMemory(admin, msg, text, reply);
    return;
  }

  // ============ CHRO Sub-Agent Orchestration ============
  const callOrchestrator = async (body: Record<string, unknown>) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/chro-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({ error: "bad orchestrator response" }));
  };

  if (text === "/agents" || text === "/agent" || text === "/list_agents") {
    const rendered = await getCachedRender("tg:/agents", async () => {
      const out = await callOrchestrator({ action: "list_agents" });
      return {
        state: out?.agents || [],
        render: (agents: any[]) => {
          if (!agents.length) return "কোনো sub-agent registered নেই।";
          const lines = agents.map(
            (a: any) =>
              `• <b>/${a.slug}</b> — ${a.display_name}\n   ${a.is_active ? "🟢" : "🔴"} ${a.role_title}\n   ✅ ${a.success_count} | ❌ ${a.failure_count}${a.last_invoked_at ? ` | last: ${new Date(a.last_invoked_at).toISOString().slice(0, 16).replace("T", " ")}` : ""}`,
          );
          return `🤝 <b>CHRO Sub-Agent Roster</b> <i>(cached)</i>\n\n${lines.join("\n\n")}\n\nUsage: <code>/dev &lt;task&gt;</code>, <code>/sec ...</code>, <code>/marketing ...</code>, <code>/growth ...</code>, or <code>/ask &lt;slug&gt; &lt;task&gt;</code>`;
        },
      };
    });
    await sendTg(chatId, rendered);
    return;
  }

  {
    const m = text.match(/^\/agent_create\s+(.+)$/i);
    if (m) {
      const parts = m[1].split("|").map((s) => s.trim());
      if (parts.length < 2) {
        await sendTg(
          chatId,
          "Usage: <code>/agent_create &lt;slug&gt; | &lt;display name&gt; | &lt;role focus&gt;</code>",
        );
        return;
      }
      const [slug, display_name, role_focus] = [parts[0], parts[1], parts[2] || parts[1]];
      const out = await callOrchestrator({
        action: "create_agent",
        slug,
        display_name,
        role_focus,
      });
      if (out?.error) {
        await sendTg(chatId, `⚠️ ${out.error}`);
        return;
      }
      await sendTg(
        chatId,
        `✅ Sub-agent registered: <b>/${out.agent.slug}</b> — ${out.agent.display_name}\nInvoke: <code>/ask ${out.agent.slug} &lt;task&gt;</code>`,
      );
      return;
    }
  }

  if (text === "/agents_health") {
    const rendered = await getCachedRender("tg:/agents_health", async () => {
      const out = await callOrchestrator({ action: "health" });
      return {
        state: { agents: out?.agents || [], c: out?.proposals_24h || {} },
        render: ({ agents, c }: any) => {
          const lines = agents.map((a: any) => {
            const k = c[a.slug] || { pending: 0, approved: 0, applied: 0, rejected: 0 };
            const errLine = a.last_error ? `\n   ⚠️ ${String(a.last_error).slice(0, 80)}` : "";
            return `• <b>${a.display_name}</b> [/${a.slug}] ${a.is_active ? "🟢" : "🔴"}\n   24h → pending ${k.pending} | approved ${k.approved} | applied ${k.applied} | rejected ${k.rejected}${errLine}`;
          });
          return `❤️‍🩹 <b>Sub-Agent Health (24h)</b> <i>(cached)</i>\n\n${lines.join("\n\n")}`;
        },
      };
    });
    await sendTg(chatId, rendered);
    return;
  }

  {
    const slugMap: Record<string, string> = {
      "/sec": "sec",
      "/dev": "dev",
      "/marketing": "marketing",
      "/growth": "growth",
    };
    let agentSlug: string | null = null;
    let taskText = "";
    for (const cmd of Object.keys(slugMap)) {
      if (text === cmd || text.startsWith(cmd + " ")) {
        agentSlug = slugMap[cmd];
        taskText = text.slice(cmd.length).trim();
        break;
      }
    }
    const askMatch = text.match(/^\/ask\s+([a-z0-9_]+)\s+(.+)$/i);
    if (askMatch) {
      agentSlug = askMatch[1].toLowerCase();
      taskText = askMatch[2].trim();
    }
    if (!agentSlug) {
      const dynamicCmd = text.match(/^\/([a-z0-9_]{2,32})\s+(.+)$/i);
      const reserved = new Set([
        "start",
        "help",
        "id",
        "agent",
        "agents",
        "list_agents",
        "agent_create",
        "agents_health",
        "show",
        "pending",
        "alerts",
        "approve",
        "reject",
        "applied",
      ]);
      if (dynamicCmd && !reserved.has(dynamicCmd[1].toLowerCase())) {
        agentSlug = dynamicCmd[1].toLowerCase();
        taskText = dynamicCmd[2].trim();
      }
    }

    if (agentSlug) {
      if (!taskText) {
        await sendTg(chatId, `Usage: <code>/${agentSlug} &lt;task description&gt;</code>`);
        return;
      }
      await sendChatAction(chatId);
      await sendTg(chatId, `🧠 CHRO routing task to <b>${agentSlug}</b>... planning হচ্ছে।`);
      const out = await callOrchestrator({
        action: "invoke",
        agent: agentSlug,
        task: taskText,
        requested_by: userId,
        source: "telegram",
      });
      if (out?.error) {
        await sendTg(chatId, `⚠️ ${out.agent || agentSlug}: ${out.error}`);
        return;
      }
      const reply =
        `📋 <b>Proposal #${out.proposal_id}</b> — ${out.agent.display_name}\n` +
        `<i>Plan-Only Mode — raw payload hidden।</i>\n\n` +
        `<b>HIGH-LEVEL PLAN</b>\n<pre>${escapeHtmlSafe(out.plan_summary).slice(0, 3500)}</pre>\n\n` +
        `<code>/show ${out.proposal_id}</code> — full code/payload\n` +
        `<code>/approve ${out.proposal_id}</code>  |  <code>/reject ${out.proposal_id}</code>`;
      await sendTg(chatId, reply);
      await persistTelegramTurn(admin, userId, "assistant", reply);
      return;
    }
  }

  {
    const m = text.match(/^\/show\s+([0-9a-f-]{36})$/i);
    if (m) {
      const { data: p } = await admin
        .from("agent_proposals")
        .select("id, agent_slug, task, plan_summary, payload, payload_kind, status")
        .eq("id", m[1])
        .maybeSingle();
      if (!p) {
        await sendTg(chatId, "⚠️ Proposal not found।");
        return;
      }
      const payloadStr = JSON.stringify(p.payload, null, 2);
      const chunks: string[] = [];
      for (let i = 0; i < payloadStr.length; i += 3500) chunks.push(payloadStr.slice(i, i + 3500));
      await sendTg(
        chatId,
        `🔓 <b>Proposal ${p.id}</b> [${p.agent_slug} | ${p.payload_kind} | ${p.status}]\n<b>Task:</b> ${escapeHtmlSafe(p.task).slice(0, 400)}\n\n<b>FULL PAYLOAD</b> (${chunks.length} part${chunks.length > 1 ? "s" : ""}):`,
      );
      for (let i = 0; i < chunks.length; i++) {
        await sendTg(chatId, `<pre>${escapeHtmlSafe(chunks[i])}</pre>`);
      }
      return;
    }
  }

  // ============ Pending list (unified agent_proposals queue) ============
  if (text === "/pending" || text === "/alerts") {
    const { data: props } = await admin
      .from("agent_proposals")
      .select("id, agent_slug, task, payload_kind, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(25);

    if (!props || !props.length) {
      await sendTg(chatId, "✅ কোনো pending proposal নেই।");
      return;
    }
    const out: string[] = [`📋 <b>Pending Sub-Agent Proposals</b>`];
    out.push(
      props
        .map(
          (r: any, i: number) =>
            `${i + 1}. [/${r.agent_slug} · ${r.payload_kind}] ${escapeHtmlSafe(r.task).slice(0, 90)}\n   <code>/show ${r.id}</code> | <code>/approve ${r.id}</code> | <code>/reject ${r.id}</code>`,
        )
        .join("\n\n"),
    );
    await sendTg(chatId, out.join("\n\n"));
    return;
  }

  // ============ Approve / Reject / Applied (agent_proposals first, then legacy) ============
  {
    const m = text.match(/^\/(approve|reject|applied)\s+([0-9a-f-]{36})(?:\s+(.+))?$/i);
    if (m) {
      const decision =
        m[1].toLowerCase() === "applied"
          ? "applied"
          : m[1].toLowerCase() === "approve"
            ? "approved"
            : "rejected";
      const id = m[2];
      const note = m[3] ?? null;
      const tsField = decision === "applied" ? "applied_at" : "decided_at";

      // 1) Try agent_proposals
      const { data: prop, error: propErr } = await admin
        .from("agent_proposals")
        .update({ status: decision, decision_note: note, [tsField]: new Date().toISOString() })
        .eq("id", id)
        .select("id, agent_slug, task, plan_summary, payload, payload_kind")
        .maybeSingle();

      if (propErr || !prop) {
        await sendTg(
          chatId,
          `⚠️ Update failed: ${propErr?.message ?? "id not found in proposal queue"}`,
        );
        return;
      }
      let reply = `✅ Proposal <code>${prop.id}</code> [/${prop.agent_slug}] → <b>${decision}</b>${note ? `\nNote: ${note}` : ""}`;
      if (decision === "approved") {
        const filesArr = Array.isArray((prop.payload as any)?.files)
          ? (prop.payload as any).files
          : [];
        const sql = (prop.payload as any)?.sql || null;
        const fileList =
          filesArr.map((f: any) => `- \`${f.path}\``).join("\n") || "(no code files)";
        const devInstruction =
          `Apply approved proposal ${prop.id} from /${prop.agent_slug} (${prop.payload_kind}).\n\n` +
          `TASK: ${prop.task}\n\nPLAN:\n${prop.plan_summary}\n\n` +
          `FILES TO WRITE:\n${fileList}\n\n` +
          (sql ? `RUN MIGRATION:\n\`\`\`sql\n${sql}\n\`\`\`\n\n` : "") +
          `Full payload is in agent_proposals row ${prop.id}. Write each file exactly as in payload.files[].content, run the SQL if present, then mark applied via Telegram /applied ${prop.id}.`;
        reply += `\n\n<b>📥 Copy → send to your developer:</b>\n<pre>${escapeHtmlSafe(devInstruction).slice(0, 3500)}</pre>`;
      }
      await sendTg(chatId, reply);
      return;
    }
  }

  await sendChatAction(chatId);

  // SEMANTIC COMPRESSION: keep only the last 6 turns of raw history (session_summary
  // already holds long-term compressed context via upsertTelegramSessionMemory).
  const { data: hist } = await admin
    .from("telegram_chat_history")
    .select("role,content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  // Load CEO directives + research + cross-agent permanent learning in ONE round-trip (cached 60s).
  const memory = await loadAgentMemoryContext(admin, { scope: "telegram" });
  const systemPrompt = buildSystemPromptWithMemory(memory, TELEGRAM_EXTRA);
  const conv: any[] = [{ role: "system", content: systemPrompt }];
  for (const h of (hist || []).reverse())
    conv.push({ role: h.role, content: normalizePersonaText(h.content).slice(0, 1200) });
  if (!inboundLogged) conv.push({ role: "user", content: text });

  let finalReply = "";
  try {
    for (let i = 0; i < 5; i++) {
      const resp = await callGateway(conv);
      const m = resp?.choices?.[0]?.message;
      if (!m) break;
      const toolCalls = m.tool_calls || [];
      if (!toolCalls.length) {
        finalReply = m.content || "(empty reply)";
        break;
      }
      conv.push(m);
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch {}
        const result = await runTool(admin, tc.function?.name, args);
        conv.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
  } catch (e) {
    console.error("[webhook] gateway error", e);
    finalReply = `⚠️ AI error: ${String(e).slice(0, 200)}`;
  }

  if (!finalReply) finalReply = "Sorry, কোনো উত্তর তৈরি করতে পারিনি।";
  finalReply = normalizePersonaText(finalReply);

  await sendTg(chatId, finalReply);

  // Persist assistant turn + refresh compact session memory.
  await persistTelegramTurn(admin, userId, "assistant", finalReply);
  await upsertTelegramSessionMemory(admin, msg, text, finalReply);
}

// ---- Autonomous Sourcing approval callbacks ----
async function answerCallback(id: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text: text.slice(0, 180) }),
  }).catch(() => {});
}

async function editCallbackCaption(
  chatId: number,
  messageId: number,
  suffix: string,
  hasPhoto: boolean,
) {
  const endpoint = hasPhoto ? "editMessageCaption" : "editMessageText";
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  };
  if (hasPhoto) payload.caption = suffix;
  else payload.text = suffix;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function handleSourcingCallback(cb: any) {
  const data = String(cb?.data || "");
  const m = data.match(/^(ap|rj):([0-9a-f-]{36})$/i);
  if (!m) return;
  const fromId = String(cb?.from?.id || "");
  if (ADMIN_IDS.length && !ADMIN_IDS.includes(fromId)) {
    await answerCallback(cb.id, "Not authorized");
    return;
  }
  const action = m[1] === "ap" ? "approve" : "reject";
  const pendingId = m[2];
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret) {
    await answerCallback(cb.id, "CRON_SECRET not configured");
    return;
  }

  const hosts = [Deno.env.get("SITE_URL") || "https://arprimemarket.shop"];
  let result: any = null;
  let lastErr = "";
  for (const host of hosts) {
    try {
      const r = await fetch(`${host}/api/public/sourcing-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
        body: JSON.stringify({ id: pendingId, action, decided_by: fromId }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.ok) {
        result = body;
        break;
      }
      lastErr = body?.error || `HTTP ${r.status}`;
    } catch (e) {
      lastErr = String(e);
    }
  }

  const chatId = cb?.message?.chat?.id;
  const messageId = cb?.message?.message_id;
  const hasPhoto = Boolean(cb?.message?.photo);
  if (!result) {
    await answerCallback(cb.id, `Failed: ${lastErr.slice(0, 120)}`);
    if (chatId && messageId)
      await editCallbackCaption(
        chatId,
        messageId,
        `⚠️ <b>Action failed</b>\n${lastErr.slice(0, 200)}`,
        hasPhoto,
      );
    return;
  }
  if (action === "approve") {
    await answerCallback(cb.id, result.already ? "Already approved" : "Approved & imported ✅");
    if (chatId && messageId)
      await editCallbackCaption(
        chatId,
        messageId,
        `✅ <b>Approved & imported</b>${result.slug ? `\n→ /${result.slug}` : ""}`,
        hasPhoto,
      );
  } else {
    await answerCallback(cb.id, "Rejected ❌");
    if (chatId && messageId)
      await editCallbackCaption(chatId, messageId, `❌ <b>Rejected</b>`, hasPhoto);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // One-shot setup: register webhook with Telegram. Auth via CRON_SECRET env OR integration_secrets(cron).
  if (req.method === "GET" && url.searchParams.get("setup") === "1") {
    const provided = req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
    let allowed = false;
    const envSecret = Deno.env.get("CRON_SECRET") || "";
    if (envSecret && provided === envSecret) allowed = true;
    if (!allowed) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data } = await admin
          .from("integration_secrets")
          .select("api_key")
          .eq("provider", "cron")
          .maybeSingle();
        if (data?.api_key && provided === data.api_key) allowed = true;
      } catch {}
    }
    if (!allowed) return new Response("forbidden", { status: 403 });
    if (!BOT_TOKEN)
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    if (!WEBHOOK_SECRET)
      return new Response(JSON.stringify({ error: "TELEGRAM_WEBHOOK_SECRET missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: [
          "message",
          "edited_message",
          "channel_post",
          "edited_channel_post",
          "callback_query",
        ],
        drop_pending_updates: true,
      }),
    });
    const body = await r.json().catch(() => ({}));
    const info = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .catch((e) => ({ ok: false, error: String(e) }));
    return new Response(
      JSON.stringify(
        { ok: body?.ok === true, webhookUrl, telegram: body, webhookInfo: info },
        null,
        2,
      ),
      {
        status: body?.ok === true ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (req.method !== "POST") return new Response("ok");

  // Verify Telegram secret header
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (got !== WEBHOOK_SECRET) {
      console.warn("[webhook] bad secret token");
      return new Response("unauthorized", { status: 401 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // ACK immediately, process in background to avoid Telegram timeouts
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const msg = update.message || update.edited_message;
  const channelPost = update.channel_post || update.edited_channel_post;
  const callback = update.callback_query;
  try {
    if (callback) {
      await handleSourcingCallback(callback);
    } else if (msg) {
      await handleMessage(admin, msg);
    } else if (channelPost) {
      await handleMessage(admin, channelPost, { isChannel: true });
    }
  } catch (e) {
    console.error("[webhook] handle error", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
