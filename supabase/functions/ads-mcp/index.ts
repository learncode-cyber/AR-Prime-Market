// AI-callable MCP-style dispatcher for Meta + Google Ads actions.
// Admin-only (verify_jwt + has_role check). Logs every action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import { metaAds } from "../_shared/meta-ads.ts";
import { googleAds } from "../_shared/google-ads.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPA_URL, SERVICE_KEY);

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("unauthorized");
  const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) throw new Error("unauthorized");
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!roles?.some((r) => r.role === "admin")) throw new Error("forbidden");
  return u.user.id;
}

async function logAction(row: {
  platform: string;
  action: string;
  external_id?: string;
  campaign_name?: string;
  reason?: string;
  metrics?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  success?: boolean;
}) {
  await admin.from("ad_automation_logs").insert({ ...row, success: row.success ?? true });
}

async function telegramLog(emoji: string, platform: string, action: string, lines: string[]) {
  const text = [
    `${emoji} <b>Ad Automation — ${platform.toUpperCase()}</b>`,
    `Action: <code>${escapeHtml(action)}</code>`,
    ...lines.map(escapeHtml),
    `<i>${new Date().toISOString()}</i>`,
  ].join("\n");
  await sendTelegramMessage(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    await requireAdmin(req);
    const { platform, action, params = {} } = await req.json();
    if (!platform || !action) throw new Error("platform and action required");

    let result: unknown;
    if (platform === "meta") {
      switch (action) {
        case "create_campaign":
          result = await metaAds.createCampaign(params);
          break;
        case "create_adset":
          result = await metaAds.createAdSet(params);
          break;
        case "create_creative":
          result = await metaAds.createAdCreative(params);
          break;
        case "create_ad":
          result = await metaAds.createAd(params);
          break;
        case "pause":
          result = await metaAds.pause(params.id);
          break;
        case "set_budget":
          result = await metaAds.setDailyBudget(params.id, params.daily_budget_usd);
          break;
        default:
          throw new Error(`unknown meta action: ${action}`);
      }
    } else if (platform === "google") {
      switch (action) {
        case "create_budget":
          result = await googleAds.createBudget(params);
          break;
        case "create_campaign":
          result = await googleAds.createCampaign(params);
          break;
        case "pause":
          result = await googleAds.pauseCampaign(params.resource_name);
          break;
        case "set_budget":
          result = await googleAds.setBudgetAmount(params.budget_resource, params.daily_budget_usd);
          break;
        default:
          throw new Error(`unknown google action: ${action}`);
      }
    } else {
      throw new Error(`unknown platform: ${platform}`);
    }

    await logAction({
      platform,
      action,
      campaign_name: params.name,
      external_id: (result as any)?.id || (result as any)?.resourceName,
      payload: params,
    });

    const emoji = action.startsWith("create")
      ? "🚀"
      : action === "pause"
        ? "⏸️"
        : action === "set_budget"
          ? "📈"
          : "ℹ️";
    await telegramLog(
      emoji,
      platform,
      action,
      [
        params.name ? `Name: ${params.name}` : "",
        params.daily_budget_usd ? `Daily budget: $${params.daily_budget_usd}` : "",
      ].filter(Boolean),
    );

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-mcp]", msg);
    await logAction({ platform: "system", action: "error", reason: msg, success: false }).catch(
      () => {},
    );
    const status = /unauthorized|forbidden/.test(msg) ? 401 : 400;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
