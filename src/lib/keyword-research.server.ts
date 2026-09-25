// Centralized Keyword Research Adapter
// Supports pluggable providers. Credentials resolved in this order:
//   1. integration_settings table  (admin UI → provider + api_key + is_active)
//   2. env vars KEYWORD_PROVIDER + KEYWORD_API_KEY
//   3. LLM fallback (Gemini — admin-panel configurable, see gemini.server.ts)
//
// Supported providers: "dataforseo" | "semrush" | "ahrefs" | "serpapi" | "llm"
//
// Adding a new provider later only requires:
//   1. Adding a case in `dispatch()` below
//   2. Setting provider+api_key via admin UI OR env vars
// No other code changes needed.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { geminiGenerateJson } from "./gemini.server";

export type KeywordIdea = {
  keyword: string;
  volume?: number | null;
  cpc?: number | null;
  competition?: number | null;
  intent?: "informational" | "commercial" | "transactional" | "navigational" | null;
};

export type KeywordResearchResult = {
  provider: string;
  primary: string;
  secondary: string[];
  longTail: string[];
  ideas: KeywordIdea[];
  competitorTopics?: string[];
  notes?: string;
};

const NICHES = [
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

// ---------------- LLM Fallback (no API key required) ----------------
async function llmKeywordResearch(seed?: string): Promise<KeywordResearchResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const niche = seed?.trim() || pick(NICHES);
  const region = pick(REGIONS);

  const prompt = `You are an expert ecommerce SEO strategist. For the niche "${niche}" targeting shoppers in ${region}, do simulated keyword + competitor research using your training knowledge of real Google search behaviour, Amazon best-sellers, and ecommerce SERPs.

Return ONLY JSON with:
{
  "primary": "ONE high-converting long-tail buyer-intent keyword (4-7 words)",
  "secondary": ["3-5 supporting keywords"],
  "longTail": ["3-5 question / how-to long-tail variants"],
  "ideas": [{"keyword":"...","volume":<est monthly>,"cpc":<usd>,"competition":<0-1>,"intent":"commercial|transactional|informational"}],
  "competitorTopics": ["3-5 article angles competitors rank for, that we can outperform"]
}`;

  const parsed = await geminiGenerateJson<any>({
    system: "Respond ONLY with valid JSON. No prose.",
    prompt,
    temperature: 0.6,
    surface: "keyword",
  });
  return {
    provider: "llm",
    primary: parsed.primary || `best ${niche} ${new Date().getFullYear()}`,
    secondary: Array.isArray(parsed.secondary) ? parsed.secondary : [],
    longTail: Array.isArray(parsed.longTail) ? parsed.longTail : [],
    ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
    competitorTopics: Array.isArray(parsed.competitorTopics) ? parsed.competitorTopics : [],
    notes: `LLM-simulated research for "${niche}" in ${region}`,
  };
}

// ---------------- DataForSEO ----------------
async function dataForSeoResearch(seed: string, apiKey: string): Promise<KeywordResearchResult> {
  // apiKey format: "login:password" base64-able
  const auth = Buffer.from(apiKey).toString("base64");
  const res = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify([
        { keywords: [seed], location_code: 2840, language_code: "en", limit: 20 },
      ]),
    },
  );
  if (!res.ok) throw new Error(`DataForSEO error ${res.status}`);
  const json = await res.json();
  const items: any[] = json?.tasks?.[0]?.result ?? [];
  const ideas: KeywordIdea[] = items.map((i) => ({
    keyword: i.keyword,
    volume: i.search_volume ?? null,
    cpc: i.cpc ?? null,
    competition: i.competition_index ? i.competition_index / 100 : null,
    intent: null,
  }));
  const sorted = [...ideas].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  return {
    provider: "dataforseo",
    primary: sorted[0]?.keyword || seed,
    secondary: sorted.slice(1, 6).map((i) => i.keyword),
    longTail: sorted
      .filter((i) => i.keyword.split(" ").length >= 4)
      .slice(0, 5)
      .map((i) => i.keyword),
    ideas: sorted,
  };
}

// ---------------- Semrush ----------------
async function semrushResearch(seed: string, apiKey: string): Promise<KeywordResearchResult> {
  const url = `https://api.semrush.com/?type=phrase_related&key=${encodeURIComponent(apiKey)}&phrase=${encodeURIComponent(seed)}&database=us&export_columns=Ph,Nq,Cp,Co&display_limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Semrush error ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // skip header
  const ideas: KeywordIdea[] = lines.map((ln) => {
    const [keyword, nq, cp, co] = ln.split(";");
    return {
      keyword,
      volume: Number(nq) || null,
      cpc: Number(cp) || null,
      competition: Number(co) || null,
      intent: null,
    };
  });
  const sorted = [...ideas].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  return {
    provider: "semrush",
    primary: sorted[0]?.keyword || seed,
    secondary: sorted.slice(1, 6).map((i) => i.keyword),
    longTail: sorted
      .filter((i) => i.keyword.split(" ").length >= 4)
      .slice(0, 5)
      .map((i) => i.keyword),
    ideas: sorted,
  };
}

// ---------------- Ahrefs (stub) ----------------
async function ahrefsResearch(seed: string, apiKey: string): Promise<KeywordResearchResult> {
  const url = `https://api.ahrefs.com/v3/keywords-explorer/overview?target=${encodeURIComponent(seed)}&country=us`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Ahrefs error ${res.status}`);
  const json: any = await res.json();
  const ideas: KeywordIdea[] = (json?.keywords ?? []).map((k: any) => ({
    keyword: k.keyword,
    volume: k.volume ?? null,
    cpc: k.cpc ?? null,
    competition: k.difficulty != null ? k.difficulty / 100 : null,
    intent: null,
  }));
  const sorted = [...ideas].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  return {
    provider: "ahrefs",
    primary: sorted[0]?.keyword || seed,
    secondary: sorted.slice(1, 6).map((i) => i.keyword),
    longTail: sorted
      .filter((i) => i.keyword.split(" ").length >= 4)
      .slice(0, 5)
      .map((i) => i.keyword),
    ideas: sorted,
  };
}

// ---------------- SerpAPI (stub) ----------------
async function serpapiResearch(seed: string, apiKey: string): Promise<KeywordResearchResult> {
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(seed)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI error ${res.status}`);
  const json: any = await res.json();
  const related: string[] = (json?.related_searches ?? []).map((r: any) => r.query).filter(Boolean);
  const ideas: KeywordIdea[] = related.map((k) => ({
    keyword: k,
    volume: null,
    cpc: null,
    competition: null,
    intent: null,
  }));
  return {
    provider: "serpapi",
    primary: seed,
    secondary: related.slice(0, 5),
    longTail: related.filter((k) => k.split(" ").length >= 4).slice(0, 5),
    ideas,
    competitorTopics: (json?.organic_results ?? [])
      .slice(0, 5)
      .map((o: any) => o.title)
      .filter(Boolean),
  };
}

// ---------------- Credential resolver ----------------
// integration_settings holds only provider + is_active (admin-readable).
// integration_secrets holds api_key (RLS denies all client access; only
// reachable via service role on the server).
async function resolveProvider(): Promise<{ provider: string; apiKey?: string }> {
  try {
    const { data: setting } = await supabaseAdmin
      .from("integration_settings")
      .select("provider, is_active")
      .eq("is_active", true)
      .in("provider", ["dataforseo", "semrush", "ahrefs", "serpapi"])
      .limit(1)
      .maybeSingle();

    if (setting?.provider) {
      const { data: secret } = await supabaseAdmin
        .from("integration_secrets")
        .select("api_key")
        .eq("provider", setting.provider)
        .maybeSingle();
      if (secret?.api_key) {
        return { provider: setting.provider.toLowerCase(), apiKey: secret.api_key };
      }
    }
  } catch (e) {
    console.warn("[keyword-research] integration lookup failed:", (e as Error)?.message);
  }
  return {
    provider: (process.env.KEYWORD_PROVIDER || "llm").toLowerCase(),
    apiKey: process.env.KEYWORD_API_KEY,
  };
}

// ---------------- Public entrypoint ----------------
export async function researchKeyword(seed?: string): Promise<KeywordResearchResult> {
  const { provider, apiKey } = await resolveProvider();

  try {
    if (provider !== "llm" && !apiKey) {
      console.warn(
        `[keyword-research] ${provider} configured but api key missing — falling back to LLM`,
      );
      return await llmKeywordResearch(seed);
    }
    const phrase = seed || pick(NICHES);
    switch (provider) {
      case "dataforseo":
        return await dataForSeoResearch(phrase, apiKey!);
      case "semrush":
        return await semrushResearch(phrase, apiKey!);
      case "ahrefs":
        return await ahrefsResearch(phrase, apiKey!);
      case "serpapi":
        return await serpapiResearch(phrase, apiKey!);
      case "llm":
      default:
        return await llmKeywordResearch(seed);
    }
  } catch (e: unknown) {
    console.error(
      `[keyword-research] ${provider} failed, falling back to LLM:`,
      e instanceof Error ? e.message : String(e),
    );
    return await llmKeywordResearch(seed);
  }
}
