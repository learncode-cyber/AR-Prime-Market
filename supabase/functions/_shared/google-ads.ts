// Google Ads REST API v17 helpers
const DEV_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "";
const CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "";
const REFRESH_TOKEN = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN") || "";
const CUSTOMER_ID = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID") || "").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = (Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") || "").replace(/-/g, "");
const API_VERSION = "v17";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN)
    throw new Error("Google Ads OAuth secrets missing");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google OAuth failed: ${JSON.stringify(j)}`);
  cachedToken = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  if (!DEV_TOKEN || !CUSTOMER_ID)
    throw new Error("Google Ads developer token or customer ID missing");
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": DEV_TOKEN,
    "Content-Type": "application/json",
  };
  if (LOGIN_CUSTOMER_ID) headers["login-customer-id"] = LOGIN_CUSTOMER_ID;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Ads ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const microsPerDollar = 1_000_000;

export const googleAds = {
  async createBudget(p: { name: string; daily_budget_usd: number }) {
    const res = await call(`/customers/${CUSTOMER_ID}/campaignBudgets:mutate`, "POST", {
      operations: [
        {
          create: {
            name: p.name,
            amountMicros: String(Math.round(p.daily_budget_usd * microsPerDollar)),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    });
    return res.results?.[0]?.resourceName as string;
  },

  async createCampaign(p: { name: string; budget_resource: string; channel_type?: string }) {
    const res = await call(`/customers/${CUSTOMER_ID}/campaigns:mutate`, "POST", {
      operations: [
        {
          create: {
            name: p.name,
            status: "PAUSED",
            advertisingChannelType: p.channel_type || "SEARCH",
            manualCpc: { enhancedCpcEnabled: false },
            campaignBudget: p.budget_resource,
          },
        },
      ],
    });
    return res.results?.[0]?.resourceName as string;
  },

  async pauseCampaign(campaign_resource: string) {
    return call(`/customers/${CUSTOMER_ID}/campaigns:mutate`, "POST", {
      operations: [
        { update: { resourceName: campaign_resource, status: "PAUSED" }, updateMask: "status" },
      ],
    });
  },

  async setBudgetAmount(budget_resource: string, daily_budget_usd: number) {
    return call(`/customers/${CUSTOMER_ID}/campaignBudgets:mutate`, "POST", {
      operations: [
        {
          update: {
            resourceName: budget_resource,
            amountMicros: String(Math.round(daily_budget_usd * microsPerDollar)),
          },
          updateMask: "amount_micros",
        },
      ],
    });
  },

  async search(query: string) {
    return call(`/customers/${CUSTOMER_ID}/googleAds:search`, "POST", { query });
  },

  async getActiveCampaignsWithMetrics(window_days = 1) {
    const q = `
      SELECT
        campaign.id, campaign.name, campaign.status, campaign.resource_name,
        campaign_budget.resource_name, campaign_budget.amount_micros,
        metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_${window_days}_DAYS
    `
      .replace(/\s+/g, " ")
      .trim();
    return call(`/customers/${CUSTOMER_ID}/googleAds:search`, "POST", { query: q });
  },
};

export function parseGoogleRoas(row: Record<string, any>) {
  const spend = Number(row.metrics?.costMicros || 0) / microsPerDollar;
  const conversions = Number(row.metrics?.conversions || 0);
  const revenue = Number(row.metrics?.conversionsValue || 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  return { spend, conversions, revenue, roas, cpa };
}
