// Meta Marketing API helpers (Graph API v20.0)
const API = "https://graph.facebook.com/v20.0";
const TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const AD_ACCOUNT = (Deno.env.get("META_AD_ACCOUNT_ID") || "").replace(/^act_/, "");

function ensure() {
  if (!TOKEN || !AD_ACCOUNT) throw new Error("META_ACCESS_TOKEN or META_AD_ACCOUNT_ID missing");
}

async function call(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, unknown>,
) {
  ensure();
  const url = new URL(`${API}${path}`);
  url.searchParams.set("access_token", TOKEN);
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (method === "GET" && body) {
    for (const [k, v] of Object.entries(body))
      url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  } else if (body) {
    init.body = JSON.stringify(body);
  }
  const r = await fetch(url.toString(), init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Meta API ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

export const metaAds = {
  async createCampaign(p: {
    name: string;
    objective?: string; // e.g. OUTCOME_SALES
    daily_budget_usd?: number;
    special_ad_categories?: string[];
  }) {
    return call(`/act_${AD_ACCOUNT}/campaigns`, "POST", {
      name: p.name,
      objective: p.objective || "OUTCOME_SALES",
      status: "PAUSED",
      special_ad_categories: p.special_ad_categories || [],
      daily_budget: p.daily_budget_usd ? Math.round(p.daily_budget_usd * 100) : undefined,
    });
  },

  async createAdSet(p: {
    name: string;
    campaign_id: string;
    daily_budget_usd: number;
    targeting: Record<string, unknown>;
    billing_event?: string;
    optimization_goal?: string;
  }) {
    return call(`/act_${AD_ACCOUNT}/adsets`, "POST", {
      name: p.name,
      campaign_id: p.campaign_id,
      daily_budget: Math.round(p.daily_budget_usd * 100),
      billing_event: p.billing_event || "IMPRESSIONS",
      optimization_goal: p.optimization_goal || "OFFSITE_CONVERSIONS",
      targeting: p.targeting,
      status: "PAUSED",
    });
  },

  async createAdCreative(p: {
    name: string;
    page_id: string;
    message: string;
    link: string;
    image_hash?: string;
  }) {
    return call(`/act_${AD_ACCOUNT}/adcreatives`, "POST", {
      name: p.name,
      object_story_spec: {
        page_id: p.page_id,
        link_data: { message: p.message, link: p.link, image_hash: p.image_hash },
      },
    });
  },

  async createAd(p: { name: string; adset_id: string; creative_id: string }) {
    return call(`/act_${AD_ACCOUNT}/ads`, "POST", {
      name: p.name,
      adset_id: p.adset_id,
      creative: { creative_id: p.creative_id },
      status: "PAUSED",
    });
  },

  async pause(node_id: string) {
    return call(`/${node_id}`, "POST", { status: "PAUSED" });
  },

  async setDailyBudget(node_id: string, daily_budget_usd: number) {
    return call(`/${node_id}`, "POST", { daily_budget: Math.round(daily_budget_usd * 100) });
  },

  async listActiveAdSets() {
    return call(`/act_${AD_ACCOUNT}/adsets`, "GET", {
      fields: "id,name,status,daily_budget,campaign_id",
      filtering: [{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }],
      limit: 100,
    });
  },

  async getInsights(node_id: string, date_preset = "yesterday") {
    return call(`/${node_id}/insights`, "GET", {
      date_preset,
      fields: "spend,impressions,clicks,actions,action_values,cpm,ctr,cpp",
    });
  },
};

// Parse purchase ROAS & CPA from Meta insights row
export function parseMetaRoas(row: Record<string, unknown>) {
  const spend = parseFloat(String(row.spend || "0"));
  const actions = (row.actions as Array<{ action_type: string; value: string }>) || [];
  const values = (row.action_values as Array<{ action_type: string; value: string }>) || [];
  const purchaseAction = actions.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase",
  );
  const purchaseValue = values.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase",
  );
  const purchases = purchaseAction ? parseFloat(purchaseAction.value) : 0;
  const revenue = purchaseValue ? parseFloat(purchaseValue.value) : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;
  return { spend, purchases, revenue, roas, cpa };
}
