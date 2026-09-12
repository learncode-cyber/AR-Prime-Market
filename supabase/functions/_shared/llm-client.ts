// Unified multi-provider LLM client.
//
// Routes calls to either Anthropic (Claude) or Google (Gemini) based on:
//   1. Explicit `provider` opt
//   2. Sub-agent slug preference (dev/swe/security → Claude when key present)
//   3. ANTHROPIC_API_KEY availability (defaults to Anthropic for "code/reasoning" agents)
//   4. Falls back to Gemini otherwise
//
// On rate-limit (429) or transient 5xx, the client transparently flips to the
// other provider so we maintain 100 % uptime as long as ONE key works.
//
// @ts-nocheck
import {
  geminiGenerateJson,
  geminiChatWithTools,
  isGeminiConfigured,
  isGeminiConfiguredDb,
  DEFAULT_GEMINI_MODEL,
} from "./gemini.ts";

export type LlmProvider = "anthropic" | "gemini";

export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

const CLAUDE_PREFERRED_AGENTS = new Set([
  "dev",
  "swe",
  "engineer",
  "developer",
  "code",
  "sec",
  "security",
  "architect",
]);

function hasAnthropic(): boolean {
  return !!Deno.env.get("ANTHROPIC_API_KEY");
}

export async function pickProvider(
  opts: { agent?: string; provider?: LlmProvider } = {},
): Promise<LlmProvider> {
  if (opts.provider) return opts.provider;
  const agent = (opts.agent || "").toLowerCase().trim();
  const geminiReady = await isGeminiConfiguredDb();
  if (hasAnthropic() && (CLAUDE_PREFERRED_AGENTS.has(agent) || !geminiReady)) {
    return "anthropic";
  }
  if (!geminiReady && hasAnthropic()) return "anthropic";
  return "gemini";
}

// ---------- Anthropic primitives ----------

type OpenAiMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type?: string; function: { name: string; arguments: string } }>;
};

type OpenAiTool = {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
};

function toAnthropicMessages(messages: OpenAiMsg[]): { system?: string; messages: any[] } {
  const sys: string[] = [];
  const out: any[] = [];
  const nameById: Record<string, string> = {};
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls)
        if (tc.id && tc.function?.name) nameById[tc.id] = tc.function.name;
    }
  }
  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content.trim()) sys.push(m.content);
      continue;
    }
    if (m.role === "user") {
      out.push({ role: "user", content: String(m.content ?? "") });
      continue;
    }
    if (m.role === "assistant") {
      const parts: any[] = [];
      if (typeof m.content === "string" && m.content.length)
        parts.push({ type: "text", text: m.content });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let input: any = {};
          try {
            input = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            input = {};
          }
          parts.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
        }
      }
      if (parts.length) out.push({ role: "assistant", content: parts });
      continue;
    }
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id || "",
            content: String(m.content ?? ""),
          },
        ],
      });
      continue;
    }
  }
  return { system: sys.join("\n\n") || undefined, messages: out };
}

function toAnthropicTools(tools?: OpenAiTool[]) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

async function anthropicFetch(body: any, model: string): Promise<Response> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4096, ...body }),
  });
}

async function anthropicGenerateJson<T = unknown>(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const model = opts.model || DEFAULT_ANTHROPIC_MODEL;
  const sys =
    (opts.system || "") +
    "\n\nIMPORTANT: Respond with a SINGLE valid JSON object only, no prose, no code fences.";
  const r = await anthropicFetch(
    {
      system: sys,
      temperature: opts.temperature ?? 0.5,
      messages: [{ role: "user", content: opts.prompt }],
    },
    model,
  );
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  const text = (j?.content ?? [])
    .map((p: any) => p?.text ?? "")
    .join("")
    .trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/[{\[][\s\S]*[}\]]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`Anthropic returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function anthropicChatWithTools(opts: {
  messages: OpenAiMsg[];
  tools?: OpenAiTool[];
  model?: string;
  temperature?: number;
}) {
  const model = opts.model || DEFAULT_ANTHROPIC_MODEL;
  const { system, messages } = toAnthropicMessages(opts.messages);
  const tools = toAnthropicTools(opts.tools);
  const body: any = { temperature: opts.temperature ?? 0.4, messages };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  const r = await anthropicFetch(body, model);
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  let text = "";
  const tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];
  for (const block of j?.content ?? []) {
    if (block?.type === "text" && typeof block.text === "string") text += block.text;
    if (block?.type === "tool_use") {
      tool_calls.push({
        id: block.id || `call_${tool_calls.length}_${Date.now().toString(36)}`,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }
  return { content: text || null, tool_calls };
}

// ---------- Unified entrypoints with cross-provider fallback ----------

function isRetryable(err: any): boolean {
  const s = String(err?.message || err || "");
  // Include 401/403/authentication so an invalid/expired Anthropic key falls back to Gemini
  // instead of hard-failing the whole pipeline.
  return /\b(401|403|429|500|502|503|504|quota|rate|overloaded|timeout|invalid x-api-key|authentication_error|unauthorized|forbidden)\b/i.test(
    s,
  );
}

export async function llmGenerateJson<T = unknown>(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  agent?: string;
  surface?: string;
  provider?: LlmProvider;
}): Promise<T> {
  const primary = await pickProvider({ agent: opts.agent, provider: opts.provider });
  const secondary: LlmProvider = primary === "anthropic" ? "gemini" : "anthropic";
  const run = async (p: LlmProvider): Promise<T> => {
    if (p === "anthropic") {
      return await anthropicGenerateJson<T>({
        prompt: opts.prompt,
        system: opts.system,
        model: opts.model && opts.model.startsWith("claude") ? opts.model : undefined,
        temperature: opts.temperature,
      });
    }
    return await geminiGenerateJson<T>({
      prompt: opts.prompt,
      system: opts.system,
      model: opts.model && opts.model.startsWith("gemini") ? opts.model : undefined,
      temperature: opts.temperature,
      surface: opts.surface,
    });
  };
  try {
    return await run(primary);
  } catch (e) {
    const canFallback = secondary === "anthropic" ? hasAnthropic() : await isGeminiConfiguredDb();
    if (canFallback && isRetryable(e)) {
      console.warn(
        `[llm-client] ${primary} failed (${String(e).slice(0, 120)}), falling back to ${secondary}`,
      );
      return await run(secondary);
    }
    throw e;
  }
}

export async function llmChatWithTools(opts: {
  messages: OpenAiMsg[];
  tools?: OpenAiTool[];
  model?: string;
  temperature?: number;
  agent?: string;
  surface?: string;
  provider?: LlmProvider;
}) {
  const primary = await pickProvider({ agent: opts.agent, provider: opts.provider });
  const secondary: LlmProvider = primary === "anthropic" ? "gemini" : "anthropic";
  const run = async (p: LlmProvider) => {
    if (p === "anthropic") {
      return await anthropicChatWithTools({
        messages: opts.messages,
        tools: opts.tools,
        model: opts.model && opts.model.startsWith("claude") ? opts.model : undefined,
        temperature: opts.temperature,
      });
    }
    return await geminiChatWithTools({
      messages: opts.messages,
      tools: opts.tools,
      model: opts.model && opts.model.startsWith("gemini") ? opts.model : undefined,
      temperature: opts.temperature,
      surface: opts.surface,
    });
  };
  try {
    return await run(primary);
  } catch (e) {
    const canFallback = secondary === "anthropic" ? hasAnthropic() : await isGeminiConfiguredDb();
    if (canFallback && isRetryable(e)) {
      console.warn(
        `[llm-client] ${primary} chat failed (${String(e).slice(0, 120)}), falling back to ${secondary}`,
      );
      return await run(secondary);
    }
    throw e;
  }
}

export async function llmStatus() {
  return {
    anthropic: hasAnthropic(),
    gemini: await isGeminiConfiguredDb(),
    default_anthropic_model: DEFAULT_ANTHROPIC_MODEL,
    default_gemini_model: DEFAULT_GEMINI_MODEL,
  };
}
