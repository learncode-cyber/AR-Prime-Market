// Direct Google Gemini client for Supabase Edge Functions.
//
// API Key Pooling & Fallback:
// Each helper accepts an optional `surface` (e.g. "telegram", "support",
// "research"). The resolver looks for `<SURFACE>_GEMINI_KEY` in the env
// first, then falls back to the master `GEMINI_API_KEY`. Add a per-surface
// secret in Supabase to spin off that agent to its own key without code
// changes.
// @ts-nocheck

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image-preview";

function surfaceEnvName(surface?: string): string | null {
  if (!surface) return null;
  const norm = surface
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return norm ? `${norm}_GEMINI_KEY` : null;
}

export function resolveGeminiKey(surface?: string): string {
  const envName = surfaceEnvName(surface);
  const specific = envName ? Deno.env.get(envName) : undefined;
  const master = Deno.env.get("GEMINI_API_KEY");
  const key = specific || master;
  if (!key) {
    throw new Error(`GEMINI_API_KEY not configured${envName ? ` (also checked ${envName})` : ""}`);
  }
  return key;
}

export function isGeminiConfigured(surface?: string): boolean {
  const envName = surfaceEnvName(surface);
  return !!((envName && Deno.env.get(envName)) || Deno.env.get("GEMINI_API_KEY"));
}

// ---------------------------------------------------------------------------
// Admin-panel-configurable key resolution (2026-07 addition).
//
// The functions above (`resolveGeminiKey`, `isGeminiConfigured`) are
// intentionally left UNCHANGED — env-var-only, synchronous — so every
// existing caller keeps working exactly as before with zero risk, since
// this file cannot be executed or tested in the sandbox that wrote this
// (no Deno runtime available there — see docs/architecture/AI_KEY_CONFIG.md
// for the full picture and what still needs a live-environment check).
//
// These new `*Db` variants add the same "paste it in the admin panel and
// it just works" behavior the Node/TanStack side already has (see
// src/lib/gemini.server.ts) — checking the `api_credentials` table
// (provider='gemini') before falling back to the master env var. Callers
// should prefer these; the old sync versions remain only for any caller
// not yet migrated to await them.
let dbKeyCache: { value: string | null; fetchedAt: number } | null = null;
const DB_KEY_CACHE_TTL_MS = 60_000;

async function fetchGeminiKeyFromAdminPanel(): Promise<string | null> {
  const now = Date.now();
  if (dbKeyCache && now - dbKeyCache.fetchedAt < DB_KEY_CACHE_TTL_MS) {
    return dbKeyCache.value;
  }
  let value: string | null = null;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin
      .from("api_credentials")
      .select("credentials, is_active")
      .eq("provider", "gemini")
      .maybeSingle();
    const creds = data?.credentials as Record<string, unknown> | undefined;
    if (data?.is_active !== false && typeof creds?.api_key === "string" && creds.api_key) {
      value = creds.api_key as string;
    }
  } catch (_e) {
    // DB unreachable, table not migrated yet, or import failed — fall
    // through to env vars. Never let this break the caller.
    value = null;
  }
  dbKeyCache = { value, fetchedAt: now };
  return value;
}

export async function resolveGeminiKeyDb(surface?: string): Promise<string> {
  const envName = surfaceEnvName(surface);
  const specific = envName ? Deno.env.get(envName) : undefined;
  if (specific) return specific;

  const fromAdminPanel = await fetchGeminiKeyFromAdminPanel();
  if (fromAdminPanel) return fromAdminPanel;

  const master = Deno.env.get("GEMINI_API_KEY");
  if (master) return master;

  throw new Error(
    `Gemini API key not configured. Set it in Admin Panel -> API Keys -> Google Gemini AI${envName ? `, or set ${envName} / GEMINI_API_KEY` : ", or set GEMINI_API_KEY"}.`,
  );
}

export async function isGeminiConfiguredDb(surface?: string): Promise<boolean> {
  try {
    await resolveGeminiKeyDb(surface);
    return true;
  } catch {
    return false;
  }
}

function endpoint(model: string, apiKey: string, action = "generateContent"): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:${action}?key=${encodeURIComponent(apiKey)}`;
}

// Models tried in order when the primary returns 429. First entry = primary.
const FALLBACK_MODELS = [
  DEFAULT_GEMINI_MODEL, // gemini-2.5-flash
  "gemini-2.5-flash-lite", // cheaper, separate quota bucket
  "gemini-2.0-flash", // legacy fallback
];

async function fetchWithRetry(
  buildUrl: (model: string) => string,
  body: any,
  opts: { model: string; tryFallbackModels?: boolean } = {
    model: DEFAULT_GEMINI_MODEL,
    tryFallbackModels: true,
  },
): Promise<Response> {
  const models =
    opts.tryFallbackModels === false
      ? [opts.model]
      : [opts.model, ...FALLBACK_MODELS.filter((m) => m !== opts.model)];
  let lastErr = "";
  for (const model of models) {
    // 2 retries per model on 429 with exponential backoff (500ms, 1500ms)
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(buildUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) return r;
      if (r.status !== 429) {
        // non-429 errors: don't waste retries, fail fast
        return r;
      }
      lastErr = `${model} 429 attempt ${attempt + 1}`;
      if (attempt < 2) {
        await new Promise((res) => setTimeout(res, 500 * Math.pow(3, attempt)));
      }
    }
    // fall through to next model
    console.warn(`[gemini] quota exhausted on ${model}, trying next fallback`);
  }
  return new Response(
    JSON.stringify({
      error: { code: 429, message: `All Gemini models quota-exhausted: ${lastErr}` },
    }),
    { status: 429 },
  );
}

type OpenAiMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function: { name: string; arguments: string };
  }>;
};

type OpenAiTool = {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
};

function toGeminiContents(messages: OpenAiMsg[]) {
  const systemTexts: string[] = [];
  const contents: any[] = [];

  const nameById: Record<string, string> = {};
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (tc.id && tc.function?.name) nameById[tc.id] = tc.function.name;
      }
    }
  }

  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content.trim()) systemTexts.push(m.content);
      continue;
    }
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: String(m.content ?? "") }] });
      continue;
    }
    if (m.role === "assistant") {
      const parts: any[] = [];
      if (typeof m.content === "string" && m.content.length > 0) {
        parts.push({ text: m.content });
      }
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            args = {};
          }
          parts.push({ functionCall: { name: tc.function?.name, args } });
        }
      }
      if (parts.length) contents.push({ role: "model", parts });
      continue;
    }
    if (m.role === "tool") {
      const fnName = m.name || nameById[m.tool_call_id || ""] || "tool";
      let response: unknown;
      try {
        response = JSON.parse(String(m.content ?? "{}"));
      } catch {
        response = { result: String(m.content ?? "") };
      }
      if (response === null || typeof response !== "object" || Array.isArray(response)) {
        response = { result: response };
      }
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: fnName, response } }],
      });
      continue;
    }
  }

  const systemInstruction = systemTexts.length
    ? { parts: [{ text: systemTexts.join("\n\n") }] }
    : undefined;
  return { systemInstruction, contents };
}

function toGeminiTools(tools?: OpenAiTool[]) {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? "",
        parameters: t.function.parameters ?? { type: "object", properties: {} },
      })),
    },
  ];
}

export async function geminiGenerate(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  surface?: string;
}): Promise<string> {
  const apiKey = await resolveGeminiKeyDb(opts.surface);
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const body: any = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.7 },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const r = await fetchWithRetry((m) => endpoint(m, apiKey), body, {
    model,
    tryFallbackModels: true,
  });
  if (!r.ok) {
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  const j = await r.json();
  return (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("")
    .trim();
}

export async function geminiGenerateJson<T = unknown>(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  surface?: string;
}): Promise<T> {
  const apiKey = await resolveGeminiKeyDb(opts.surface);
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const body: any = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      responseMimeType: "application/json",
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const r = await fetchWithRetry((m) => endpoint(m, apiKey), body, {
    model,
    tryFallbackModels: true,
  });
  if (!r.ok) {
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  const j = await r.json();
  const text = (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("")
    .trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/[{\[][\s\S]*[}\]]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export async function geminiChatWithTools(opts: {
  messages: OpenAiMsg[];
  tools?: OpenAiTool[];
  model?: string;
  temperature?: number;
  surface?: string;
}): Promise<{
  content: string | null;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}> {
  const apiKey = await resolveGeminiKeyDb(opts.surface);
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const { systemInstruction, contents } = toGeminiContents(opts.messages);
  const body: any = {
    contents,
    generationConfig: { temperature: opts.temperature ?? 0.4 },
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  const tools = toGeminiTools(opts.tools);
  if (tools) body.tools = tools;

  const r = await fetchWithRetry((m) => endpoint(m, apiKey), body, {
    model,
    tryFallbackModels: true,
  });
  if (!r.ok) {
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  const j = await r.json();
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  const toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];
  for (const p of parts) {
    if (typeof p?.text === "string" && p.text.length) text += p.text;
    if (p?.functionCall?.name) {
      toolCalls.push({
        id: `call_${toolCalls.length}_${Date.now().toString(36)}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      });
    }
  }
  return { content: text || null, tool_calls: toolCalls };
}

export async function geminiGenerateImage(opts: {
  prompt: string;
  model?: string;
  surface?: string;
}): Promise<{ b64: string; mime: string } | null> {
  const apiKey = await resolveGeminiKeyDb(opts.surface);
  const model = opts.model || GEMINI_IMAGE_MODEL;
  const r = await fetch(endpoint(model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!r.ok) {
    console.error("[gemini-image]", r.status, (await r.text()).slice(0, 300));
    return null;
  }
  const j = await r.json();
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const data = p?.inlineData?.data || p?.inline_data?.data;
    const mime = p?.inlineData?.mimeType || p?.inline_data?.mime_type || "image/png";
    if (data) return { b64: data, mime };
  }
  return null;
}
