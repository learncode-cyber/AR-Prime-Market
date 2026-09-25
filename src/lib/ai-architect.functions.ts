import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  prompt: z.string().min(3).max(4000),
  componentName: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  applyImmediately: z.boolean().optional().default(true),
});

const ARCHITECT_SYSTEM = `You are "Claude Code Architect" for a TanStack/React + Tailwind CSS e-commerce admin (AR Prime Market, BDT currency).
Your job: interpret the admin's natural-language design or layout request and return ONLY a single JSON object — no prose, no markdown fences — matching this exact shape:

{
  "css_classes": "<tailwind classes to apply to the target component, space-separated, no leading/trailing whitespace>",
  "json_data": { ...any structured config (colors, copy, items, spacing tokens) the component should consume... },
  "custom_js": "",
  "summary": "<one short sentence explaining what changed>"
}

Rules:
- Use only valid Tailwind v3+ utility classes. No arbitrary unknown class names.
- Never output executable JavaScript. "custom_js" MUST be an empty string.
- Keep json_data shallow, JSON-serializable, and self-describing.
- Stay scoped to the requested component — do not invent new components.
- Output strictly the JSON object, nothing else.`;

async function resolveAnthropicKey(): Promise<string | null> {
  // Prefer DB-stored secret (admin-managed via Integrations UI)
  try {
    const { data } = await supabaseAdmin
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "anthropic")
      .maybeSingle();
    if (data?.api_key) return data.api_key;
  } catch {
    /* ignore */
  }
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
}

async function callAnthropic(apiKey: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      system: ARCHITECT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude");
  return text;
}

async function callGeminiFallback(userPrompt: string): Promise<string> {
  const { geminiGenerateText } = await import("./gemini.server");
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "No Claude key set and GEMINI_API_KEY missing — add Anthropic key via Admin → Integrations or set GEMINI_API_KEY.",
    );
  }
  return await geminiGenerateText({
    system: ARCHITECT_SYSTEM,
    prompt: userPrompt + "\n\nReturn ONLY a JSON object.",
    temperature: 0.4,
    surface: "architect",
  });
}

function safeParseJson(text: string): {
  css_classes?: string;
  json_data?: unknown;
  custom_js?: string;
  summary?: string;
} {
  // Strip code fences if model returned them despite instructions.
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
  }
  // Extract first {...} block if surrounded by prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

export const architectGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const userPrompt = `Target component: "${data.componentName}"\nAdmin request: ${data.prompt}`;
    const claudeKey = await resolveAnthropicKey();

    let raw: string;
    let providerUsed: "claude" | "gemini-fallback";
    try {
      if (claudeKey) {
        raw = await callAnthropic(claudeKey, userPrompt);
        providerUsed = "claude";
      } else {
        raw = await callGeminiFallback(userPrompt);
        providerUsed = "gemini-fallback";
      }
    } catch (e: unknown) {
      // If Claude fails (invalid key, quota), try Gemini as a safety net.
      console.warn(
        "[architect] primary provider failed, trying fallback:",
        e instanceof Error ? e.message : String(e),
      );
      raw = await callGeminiFallback(userPrompt);
      providerUsed = "gemini-fallback";
    }

    let parsed: ReturnType<typeof safeParseJson>;
    try {
      parsed = safeParseJson(raw);
    } catch (e: unknown) {
      throw new Error(`Model returned non-JSON output: ${(raw || "").slice(0, 200)}`);
    }

    const cssClasses =
      typeof parsed.css_classes === "string" ? parsed.css_classes.slice(0, 2000) : "";
    const jsonData =
      parsed.json_data && typeof parsed.json_data === "object" ? parsed.json_data : {};
    // Always store empty custom_js — we never execute model-generated JS in the live site.
    const customJs = "";

    if (data.applyImmediately) {
      const { error } = await supabaseAdmin.from("dynamic_ui_settings").upsert(
        [
          {
            component_name: data.componentName,
            css_classes: cssClasses,
            json_data: jsonData as never,
            custom_js: customJs,
            prompt: data.prompt,
            is_active: true,
          },
        ],
        { onConflict: "component_name" },
      );
      if (error) throw new Error(`DB save failed: ${error.message}`);
    }

    return {
      ok: true,
      providerUsed,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      css_classes: cssClasses,
      json_data: jsonData,
    };
  });
