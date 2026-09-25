// Direct Google Gemini provider for TanStack server functions / server routes.
//
// Key resolution order (2026-07 update — "just paste the key in the admin
// panel and it works"):
//   1. `<SURFACE>_GEMINI_KEY` env var — advanced ops override, for
//      splitting rate-limit load across dedicated keys per agent surface.
//   2. The "gemini" entry in `api_credentials` — set via the admin panel's
//      API Keys page (same table/UI already used for SteadFast, CJ
//      Dropshipping, AliExpress — see src/lib/integrations.ts). This is
//      now the PRIMARY path: an admin can open the API Keys page, paste a
//      Gemini API key, and every AI feature (chat, shopping assistant,
//      blog generation, product AI, etc.) picks it up without touching
//      any environment variable or redeploying.
//   3. The master `GEMINI_API_KEY` env var — legacy/fallback path, so
//      existing env-var-only deployments keep working unchanged.
//
// The DB lookup is cached in-memory for 60 seconds per process (this is a
// single Hostinger Node process per the project's hosting constraints —
// see docs/devops/ENVIRONMENT.md — so a simple module-level cache is
// sufficient; no Redis needed) so a burst of AI calls doesn't each hit the
// database.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function surfaceEnvName(surface?: string): string | null {
  if (!surface) return null;
  const norm = surface
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return norm ? `${norm}_GEMINI_KEY` : null;
}

const DB_KEY_CACHE_TTL_MS = 60_000;
let dbKeyCache: { value: string | null; fetchedAt: number } | null = null;

async function fetchGeminiKeyFromAdminPanel(): Promise<string | null> {
  const now = Date.now();
  if (dbKeyCache && now - dbKeyCache.fetchedAt < DB_KEY_CACHE_TTL_MS) {
    return dbKeyCache.value;
  }
  let value: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("api_credentials")
      .select("credentials, is_active")
      .eq("provider", "gemini")
      .maybeSingle();
    const creds = data?.credentials as Record<string, unknown> | undefined;
    if (data?.is_active !== false && typeof creds?.api_key === "string" && creds.api_key) {
      value = creds.api_key;
    }
  } catch {
    // DB unreachable or table not migrated yet — fall through to env vars.
    value = null;
  }
  dbKeyCache = { value, fetchedAt: now };
  return value;
}

/** Test-only: forces the next call to re-fetch from the DB instead of using the cache. */
export function _resetGeminiKeyCacheForTests(): void {
  dbKeyCache = null;
}

/**
 * Resolve the API key for a given agent surface. Returns the surface-specific
 * env override when set, otherwise the admin-panel-configured key, otherwise
 * the master GEMINI_API_KEY env var. Throws if none exist.
 */
export async function resolveGeminiKey(surface?: string): Promise<string> {
  const envName = surfaceEnvName(surface);
  const specific = envName ? process.env[envName] : undefined;
  if (specific) return specific;

  const fromAdminPanel = await fetchGeminiKeyFromAdminPanel();
  if (fromAdminPanel) return fromAdminPanel;

  const master = process.env.GEMINI_API_KEY;
  if (master) return master;

  throw new Error(
    `Gemini API key not configured. Set it in Admin Panel -> API Keys -> Google Gemini AI` +
      `${envName ? `, or set ${envName} / GEMINI_API_KEY` : ", or set GEMINI_API_KEY"}.`,
  );
}

export async function isGeminiConfigured(surface?: string): Promise<boolean> {
  try {
    await resolveGeminiKey(surface);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns an AI SDK language-model instance backed by Google Gemini.
 * Pass a `surface` to use a surface-specific key when configured.
 */
export async function geminiProvider(model: string = DEFAULT_GEMINI_MODEL, surface?: string) {
  const apiKey = await resolveGeminiKey(surface);
  const google = createGoogleGenerativeAI({ apiKey });
  return google(model);
}

function endpoint(model: string, apiKey: string, action = "generateContent"): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:${action}?key=${encodeURIComponent(apiKey)}`;
}

export async function geminiGenerateJson<T = unknown>(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  surface?: string;
}): Promise<T> {
  const apiKey = await resolveGeminiKey(opts.surface);
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      responseMimeType: "application/json",
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const r = await fetch(endpoint(model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  const j = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
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

export async function geminiGenerateText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  surface?: string;
}): Promise<string> {
  const apiKey = await resolveGeminiKey(opts.surface);
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.7 },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const r = await fetch(endpoint(model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  const j = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .join("")
    .trim();
}

export async function geminiGenerateImage(opts: {
  prompt: string;
  model?: string;
  surface?: string;
}): Promise<{ b64: string; mime: string } | null> {
  const apiKey = await resolveGeminiKey(opts.surface);
  const model = opts.model || "gemini-2.5-flash-image-preview";
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
  const j = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  };
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts as Array<Record<string, any>>) {
    const data = p?.inlineData?.data || p?.inline_data?.data;
    const mime = p?.inlineData?.mimeType || p?.inline_data?.mime_type || "image/png";
    if (data) return { b64: data, mime };
  }
  return null;
}
