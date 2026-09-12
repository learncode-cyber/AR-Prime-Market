// Cron worker — every 2h. Reads ad_automation_settings, pulls live metrics from
// Meta + Google Ads, pauses underperformers (ROAS < min or CPA > max), and
// scales winners (ROAS > scale_roas) by scale_pct, capped at max_daily_budget.
// Logs every decision to ad_automation_logs and Telegram.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import { metaAds, parseMetaRoas } from "../_shared/meta-ads.ts";
import { googleAds, parseGoogleRoas } from "../_shared/google-ads.ts";
import { verifyCronSecret } from "../_shared/cron-secret.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

type Settings = {
  platform: "meta" | "google";
  enabled: boolean;
  min_roas: number;
  max_cpa: number;
  scale_roas: number;
  scale_pct: number;
  max_daily_budget: number;
  monitor_window_hours: number;
};

type Decision = {
  action: "pause" | "scale" | "keep";
  reason: string;
  new_budget?: number;
  tier?: string;
};

// EXPONENTIAL SCALING ENGINE — compounds winners aggressively while guarding CPA.
// Tiers (multipliers stack on top of settings.scale_pct):
//   T1 (ROAS >= scale_roas)         → base scale_pct
//   T2 (ROAS >= scale_roas * 1.5)   → 1.5x scale_pct
//   T3 (ROAS >= scale_roas * 2.0)   → 2.0x scale_pct
// Consecutive winning days also boost the multiplier (compounding):
//   wins >= 3 → +25%, wins >= 5 → +50%, wins >= 7 → +75% (capped)
// HARD GUARDS:
//   - CPA must stay under max_cpa (auto-pause otherwise)
//   - Daily budget capped at max_daily_budget
//   - One scale per campaign per 24h
//   - Min spend $5 before any decision
function decide(
  s: Settings,
  m: { roas: number; cpa: number; spend: number },
  current_budget: number | undefined,
  consecutive_wins: number,
): Decision {
  if (m.spend < 5) return { action: "keep", reason: "insufficient spend" };
  if (m.cpa > 0 && m.cpa > s.max_cpa)
    return { action: "pause", reason: `CPA $${m.cpa.toFixed(2)} > $${s.max_cpa} (hard guard)` };
  if (m.roas > 0 && m.roas < s.min_roas)
    return { action: "pause", reason: `ROAS ${m.roas.toFixed(2)} < ${s.min_roas}` };
  if (m.roas >= s.scale_roas && current_budget) {
    // Tier multiplier from ROAS strength
    let tierMult = 1.0;
    let tier = "T1";
    if (m.roas >= s.scale_roas * 2.0) {
      tierMult = 2.0;
      tier = "T3";
    } else if (m.roas >= s.scale_roas * 1.5) {
      tierMult = 1.5;
      tier = "T2";
    }
    // Compounding boost from sustained wins
    let streakMult = 1.0;
    if (consecutive_wins >= 7) streakMult = 1.75;
    else if (consecutive_wins >= 5) streakMult = 1.5;
    else if (consecutive_wins >= 3) streakMult = 1.25;
    const effectivePct = s.scale_pct * tierMult * streakMult;
    const next = Math.min(current_budget * (1 + effectivePct / 100), s.max_daily_budget);
    if (next > current_budget + 0.01) {
      return {
        action: "scale",
        reason: `${tier} ROAS ${m.roas.toFixed(2)} · CPA $${m.cpa.toFixed(2)} · streak ${consecutive_wins}d · +${effectivePct.toFixed(0)}%`,
        new_budget: next,
        tier,
      };
    }
  }
  return { action: "keep", reason: "within thresholds" };
}

async function getScalingState(platform: string, external_id: string) {
  const { data } = await admin
    .from("ad_scaling_state")
    .select("consecutive_wins, last_scaled_at, total_scales")
    .eq("platform", platform)
    .eq("external_id", external_id)
    .maybeSingle();
  return data || { consecutive_wins: 0, last_scaled_at: null as string | null, total_scales: 0 };
}

async function recordWin(
  platform: string,
  external_id: string,
  campaign_name: string | undefined,
  m: { roas: number; cpa: number },
  budget: number,
  scaled: boolean,
) {
  const state = await getScalingState(platform, external_id);
  await admin.from("ad_scaling_state").upsert(
    {
      platform,
      external_id,
      campaign_name,
      consecutive_wins: (state.consecutive_wins || 0) + 1,
      last_roas: m.roas,
      last_cpa: m.cpa,
      last_budget: budget,
      last_scaled_at: scaled ? new Date().toISOString() : state.last_scaled_at,
      total_scales: (state.total_scales || 0) + (scaled ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_id" },
  );
}

async function resetWinStreak(platform: string, external_id: string) {
  await admin.from("ad_scaling_state").upsert(
    {
      platform,
      external_id,
      consecutive_wins: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_id" },
  );
}

async function alreadyScaledToday(platform: string, external_id: string) {
  const state = await getScalingState(platform, external_id);
  if (!state.last_scaled_at) return false;
  return Date.now() - new Date(state.last_scaled_at).getTime() < 24 * 3600 * 1000;
}

async function notify(emoji: string, title: string, lines: string[]) {
  await sendTelegramMessage(
    [`${emoji} <b>${escapeHtml(title)}</b>`, ...lines.map(escapeHtml)].join("\n"),
  );
}

async function runMeta(s: Settings) {
  const decisions: string[] = [];
  try {
    const list = await metaAds.listActiveAdSets();
    for (const adset of list.data || []) {
      try {
        const ins = await metaAds.getInsights(adset.id, "yesterday");
        const row = ins.data?.[0];
        if (!row) continue;
        const m = parseMetaRoas(row);
        const currentBudget = adset.daily_budget ? Number(adset.daily_budget) / 100 : undefined;
        const state = await getScalingState("meta", adset.id);
        const d = decide(s, m, currentBudget, state.consecutive_wins || 0);
        await admin.from("ad_automation_logs").insert({
          platform: "meta",
          action: "monitor",
          external_id: adset.id,
          campaign_name: adset.name,
          reason: d.reason,
          metrics: m,
          success: true,
        });
        if (d.action === "pause") {
          await metaAds.pause(adset.id);
          await resetWinStreak("meta", adset.id);
          await admin.from("ad_automation_logs").insert({
            platform: "meta",
            action: "pause",
            external_id: adset.id,
            campaign_name: adset.name,
            reason: d.reason,
            metrics: m,
          });
          decisions.push(`⏸️ ${adset.name} — ${d.reason}`);
        } else if (d.action === "scale" && d.new_budget && currentBudget) {
          if (await alreadyScaledToday("meta", adset.id)) {
            await recordWin("meta", adset.id, adset.name, m, currentBudget, false);
            continue;
          }
          await metaAds.setDailyBudget(adset.id, d.new_budget);
          await recordWin("meta", adset.id, adset.name, m, d.new_budget, true);
          await admin.from("ad_automation_logs").insert({
            platform: "meta",
            action: "scale",
            external_id: adset.id,
            campaign_name: adset.name,
            reason: d.reason,
            metrics: {
              ...m,
              old_budget: currentBudget,
              new_budget: d.new_budget,
              tier: d.tier,
              streak: state.consecutive_wins,
            },
          });
          decisions.push(
            `🚀 ${adset.name} [${d.tier}] $${currentBudget.toFixed(0)} → $${d.new_budget.toFixed(0)} (${d.reason})`,
          );
        } else if (d.action === "keep" && m.roas >= s.scale_roas && currentBudget) {
          // Winner but at budget cap — still bump streak
          await recordWin("meta", adset.id, adset.name, m, currentBudget, false);
        }
      } catch (e) {
        console.error("[meta adset]", adset.id, e);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    decisions.push(`❌ Meta error: ${msg}`);
    await admin
      .from("ad_automation_logs")
      .insert({ platform: "meta", action: "error", reason: msg, success: false });
  }
  return decisions;
}

async function runGoogle(s: Settings) {
  const decisions: string[] = [];
  try {
    const res = await googleAds.getActiveCampaignsWithMetrics(1);
    for (const row of res.results || []) {
      try {
        const m = parseGoogleRoas(row);
        const currentBudget = Number(row.campaignBudget?.amountMicros || 0) / 1_000_000;
        const cname = row.campaign?.name as string;
        const cres = row.campaign?.resourceName as string;
        const bres = row.campaignBudget?.resourceName as string;
        const state = await getScalingState("google", cres);
        const d = decide(s, m, currentBudget || undefined, state.consecutive_wins || 0);
        await admin.from("ad_automation_logs").insert({
          platform: "google",
          action: "monitor",
          external_id: cres,
          campaign_name: cname,
          reason: d.reason,
          metrics: m,
        });
        if (d.action === "pause" && cres) {
          await googleAds.pauseCampaign(cres);
          await resetWinStreak("google", cres);
          await admin.from("ad_automation_logs").insert({
            platform: "google",
            action: "pause",
            external_id: cres,
            campaign_name: cname,
            reason: d.reason,
            metrics: m,
          });
          decisions.push(`⏸️ ${cname} — ${d.reason}`);
        } else if (d.action === "scale" && d.new_budget && bres && currentBudget) {
          if (await alreadyScaledToday("google", cres)) {
            await recordWin("google", cres, cname, m, currentBudget, false);
            continue;
          }
          await googleAds.setBudgetAmount(bres, d.new_budget);
          await recordWin("google", cres, cname, m, d.new_budget, true);
          await admin.from("ad_automation_logs").insert({
            platform: "google",
            action: "scale",
            external_id: cres,
            campaign_name: cname,
            reason: d.reason,
            metrics: {
              ...m,
              old_budget: currentBudget,
              new_budget: d.new_budget,
              tier: d.tier,
              streak: state.consecutive_wins,
            },
          });
          decisions.push(
            `🚀 ${cname} [${d.tier}] $${currentBudget.toFixed(0)} → $${d.new_budget.toFixed(0)} (${d.reason})`,
          );
        } else if (d.action === "keep" && m.roas >= s.scale_roas && currentBudget) {
          await recordWin("google", cres, cname, m, currentBudget, false);
        }
      } catch (e) {
        console.error("[google row]", e);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    decisions.push(`❌ Google error: ${msg}`);
    await admin
      .from("ad_automation_logs")
      .insert({ platform: "google", action: "error", reason: msg, success: false });
  }
  return decisions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sec = req.headers.get("x-cron-secret") || "";
    if (!(await verifyCronSecret(sec, admin))) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const { data: settings } = await admin.from("ad_automation_settings").select("*");
    const all: string[] = [];
    for (const s of (settings as Settings[]) || []) {
      if (!s.enabled) continue;
      const lines = s.platform === "meta" ? await runMeta(s) : await runGoogle(s);
      all.push(...lines);
    }
    if (all.length) {
      await notify("🤖", "Ad Automation Sweep", all.slice(0, 30));
    }
    return new Response(JSON.stringify({ ok: true, decisions: all }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[monitor]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: cors });
  }
});
