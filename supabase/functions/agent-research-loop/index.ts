// Edge Function: agent-research-loop
// Daily self-research loop for the CHRO (Chief HR & Operations Officer) agent.
// Asks Gemini for the latest global trends in 4 verticals:
// Digital Marketing, Full-Stack Web Dev, Growth Hacking, Executive HR Strategy.
// Persists the synthesis to public.agent_research_logs in ONE batched insert
// to keep edge runtime + memory lean.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AGENT_CORE_IDENTITY } from "../_shared/agent-identity.ts";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import {
  geminiGenerate,
  geminiGenerateJson,
  isGeminiConfiguredDb,
  DEFAULT_GEMINI_MODEL,
} from "../_shared/gemini.ts";
import { verifyCronSecret } from "../_shared/cron-secret.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const TRUSTED_SOURCES =
  "Shopify blog, Meta Ads / Google Ads / TikTok Ads official blogs, Search Engine Land, Marketing Brew, Smart Insights, ConversionXL, HubSpot e-commerce, CJ Dropshipping product updates, AliExpress trend reports, AdEspresso, Foreplay (ad library), Minea, PiPiADS, Klaviyo blog";

const VERTICALS = [
  {
    category: "winning_products",
    focus:
      "Trending dropshipping winning products this week (CJ/AliExpress/TikTok Shop) for Electronics, Beauty, Fashion, Home, Gadgets — USD pricing, profit margin >= 35%, validated demand signals, low return-rate, fast shipping availability.",
  },
  {
    category: "ad_creatives",
    focus:
      "Winning ad creative formats & hooks on Meta/Google/TikTok for dropshipping e-commerce this week — UGC styles, hook patterns, CTA frames, thumbnail patterns, CPM/CTR/CPA benchmarks for the target markets (USA/CA/UK/EU/AU/UAE).",
  },
  {
    category: "cro_checkout",
    focus:
      "Checkout & CRO tactics for international dropshipping stores — abandoned cart recovery, upsell/cross-sell, AOV lifters, trust signals, mobile checkout speed, payment-method conversion uplift.",
  },
  {
    category: "supply_retention",
    focus:
      "CJ Dropshipping supply chain reliability, shipping time optimization, customer-support automation patterns, post-purchase retention email/push playbooks, and refund/return prevention for international DTC stores.",
  },
];

type Finding = {
  title: string;
  summary: string;
  key_takeaways: string[];
  ar_prime_application?: string;
  risk_or_kill_rule?: string;
};

async function researchVertical(focus: string): Promise<Finding[]> {
  if (!(await isGeminiConfiguredDb())) return [];
  const prompt = `${AGENT_CORE_IDENTITY}

Today's daily research routine — scan the most current intelligence from trusted sources: ${TRUSTED_SOURCES}.
Focus area: ${focus}.

Synthesize 2-3 DURABLE, ACTIONABLE findings that AR Prime Market can deploy this week to scale revenue safely toward the $5M milestone.

Every finding MUST pass the 🛡️ ZERO-LOSS MANDATE filter:
- Must have at least 2 validation signals (cited trend, competitor proof, search demand, prior winning pattern).
- Must include a concrete kill-rule or budget cap so no dollar is wasted on unverified ideas.
- Tie each finding directly to AR Prime Market's catalog (Electronics, Beauty, Fashion, Home, Gadgets) and USD pricing.

Return STRICT JSON ONLY:
{"findings":[{"title":"short title","summary":"1-2 sentence executive summary","key_takeaways":["concrete action 1","concrete action 2","concrete action 3"],"ar_prime_application":"how AR Prime Market deploys this THIS WEEK","risk_or_kill_rule":"budget cap / kill-trigger so $0 is wasted"}]}`;

  try {
    const parsed = await geminiGenerateJson<{ findings?: unknown }>({
      prompt,
      surface: "research",
    });
    return Array.isArray((parsed as any)?.findings) ? (parsed as any).findings.slice(0, 3) : [];
  } catch (e) {
    console.error("[agent-research-loop] gemini", String(e));
    return [];
  }
}

async function generateCeoBriefing(
  results: Array<{ v: { category: string; focus: string }; findings: Finding[] }>,
): Promise<string> {
  if (!(await isGeminiConfiguredDb())) return "";
  const compact = results.map(({ v, findings }) => ({
    category: v.category,
    findings: findings.map((f) => ({
      title: f.title,
      summary: f.summary,
      takeaways: f.key_takeaways,
      apply: f.ar_prime_application,
      kill_rule: f.risk_or_kill_rule,
    })),
  }));

  const prompt = `${AGENT_CORE_IDENTITY}

আজকের daily research loop শেষ হয়েছে। নিচের raw findings থেকে CEO-এর জন্য একটি executive synthesis briefing লেখো (Telegram HTML format, সর্বোচ্চ ~3500 char)।

Findings JSON:
${JSON.stringify(compact)}

Briefing structure (অবশ্যই বাংলায়, technical term ইংরেজি OK):
1. <b>🧠 আজকের শেখা (TL;DR)</b> — 3-5 bullet, সবচেয়ে গুরুত্বপূর্ণ trends।
2. <b>🎯 AR Prime Market-এ এই সপ্তাহে যা করব</b> — 4-6 concrete action (কোন category/product/ad-এ), প্রতিটিতে expected ROAS বা CPA cap বা budget cap উল্লেখ করো।
3. <b>🛡️ Zero-Loss Guardrails</b> — কোন kill-rule, validation signal, hedged budget apply করব ($0 waste নিশ্চিত করতে)।
4. <b>📈 $5M milestone-এর দিকে অগ্রগতি</b> — এই learnings revenue trajectory-এ কীভাবে accelerate করবে, এক প্যারাগ্রাফ।

শুধু HTML text (<b>, <i>, <code>, line breaks) ব্যবহার করো — Markdown নয়। কোনো JSON wrapper নয়, শুধু briefing body।`;

  try {
    return (await geminiGenerate({ prompt, temperature: 0.7, surface: "research" })).trim();
  } catch (e) {
    console.error("[agent-research-loop] briefing gemini", String(e));
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const sec = req.headers.get("x-cron-secret") || "";
    if (!(await verifyCronSecret(sec, admin))) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    // Run verticals in parallel — bounded fan-out (4) keeps memory tiny.
    const results = await Promise.all(
      VERTICALS.map(async (v) => ({ v, findings: await researchVertical(v.focus) })),
    );

    // Flatten into a single batched insert.
    const rows: Array<Record<string, unknown>> = [];
    for (const { v, findings } of results) {
      for (const f of findings) {
        if (!f?.title || !f?.summary) continue;
        const takeaways = Array.isArray(f.key_takeaways) ? f.key_takeaways.slice(0, 6) : [];
        if (f.ar_prime_application) takeaways.push(`APPLY → ${f.ar_prime_application}`);
        if (f.risk_or_kill_rule) takeaways.push(`KILL-RULE → ${f.risk_or_kill_rule}`);
        rows.push({
          category: v.category,
          title: String(f.title).slice(0, 240),
          summary: String(f.summary).slice(0, 1200),
          key_takeaways: takeaways.slice(0, 8),
          source_query: `${v.focus} | sources: ${TRUSTED_SOURCES}`,
          model_used: "google/gemini-3-flash-preview",
        });
      }
    }

    let inserted = 0;
    if (rows.length) {
      const { error } = await admin.from("agent_research_logs").insert(rows);
      if (error) {
        console.error("[agent-research-loop] insert", error);
      } else {
        inserted = rows.length;
      }
    }

    // CRITICAL: send daily synthesis briefing to CEO via Telegram.
    if (inserted > 0) {
      const briefing = await generateCeoBriefing(results);
      const header = `🧭 <b>CHRO Daily Briefing</b> — ${new Date().toUTCString()}\n<i>${inserted} fresh findings synthesized from trusted sources.</i>\n\n`;
      const body =
        briefing && briefing.length > 0
          ? briefing
          : rows
              .slice(0, 6)
              .map(
                (r, i) =>
                  `${i + 1}. <b>${escapeHtml(String(r.category))}</b> — ${escapeHtml(String(r.title))}\n${escapeHtml(String(r.summary))}`,
              )
              .join("\n\n");
      const footer =
        "\n\n🛡️ <i>Every action above filtered through the Zero-Loss Mandate. Target: $5M revenue milestone.</i>";
      const full = (header + body + footer).slice(0, 3900);
      await sendTelegramMessage(full);
    } else {
      await sendTelegramMessage(
        `⚠️ <b>CHRO Daily Briefing</b>\nResearch loop ran but produced 0 usable findings. Will retry next cycle.`,
      );
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, verticals: VERTICALS.map((v) => v.category) }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agent-research-loop]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: cors });
  }
});
