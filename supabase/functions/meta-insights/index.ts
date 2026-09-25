// Meta Pixel Insights — fetches event stats from Meta Graph API for admin dashboard.
// GET ?days=7|30  -> { range, totals, daily: [{date, PageView, ViewContent, ...}], capi }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API_VERSION = "v21.0";
const TRACKED = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"];

import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const pixelId = Deno.env.get("META_PIXEL_ID");
  if (!accessToken || !pixelId) {
    return json({ error: "META_ACCESS_TOKEN or META_PIXEL_ID not configured" }, 500);
  }

  const url = new URL(req.url);
  let daysParam = url.searchParams.get("days");
  if (!daysParam && req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.days) daysParam = String(body.days);
    } catch {
      /* ignore */
    }
  }
  const days = Math.max(1, Math.min(90, Number(daysParam || "7")));

  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const until = Math.floor(Date.now() / 1000);

  // Meta Pixel stats endpoint - aggregated by event
  const statsUrl = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/stats?start_time=${since}&end_time=${until}&aggregation=event&access_token=${encodeURIComponent(accessToken)}`;

  const totals: Record<string, number> = {};
  let daily: Array<Record<string, unknown>> = [];
  let capiActive = false;
  let metaError: string | null = null;

  try {
    const res = await fetch(statsUrl);
    const data = await res.json();
    if (!res.ok) {
      metaError = data?.error?.message || `Meta API ${res.status}`;
    } else {
      const rows: Array<{ event: string; count: number; value?: number }> = data?.data || [];
      for (const r of rows) {
        if (TRACKED.includes(r.event)) {
          totals[r.event] = (totals[r.event] || 0) + (r.count || 0);
        }
      }
    }
  } catch (e) {
    metaError = (e as Error).message;
  }

  // Daily breakdown - separate call aggregated by day
  try {
    const dailyUrl = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/stats?start_time=${since}&end_time=${until}&aggregation=daily_unique_users&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(dailyUrl);
    const data = await res.json();
    if (res.ok && Array.isArray(data?.data)) {
      // Build per-day map
      const byDay: Record<string, Record<string, number>> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date((until - i * 86400) * 1000).toISOString().slice(0, 10);
        byDay[d] = { date: 0 } as unknown as Record<string, number>;
        byDay[d] = {};
        for (const ev of TRACKED) byDay[d][ev] = 0;
      }
      for (const row of data.data as Array<{
        start_time?: string;
        event?: string;
        count?: number;
      }>) {
        const day = row.start_time ? row.start_time.slice(0, 10) : null;
        if (day && byDay[day] && row.event && TRACKED.includes(row.event)) {
          byDay[day][row.event] = (byDay[day][row.event] || 0) + (row.count || 0);
        }
      }
      daily = Object.entries(byDay)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, ev]) => ({ date, ...ev }));
    }
  } catch {
    /* daily optional */
  }

  // CAPI pipeline health: hit our own meta-capi function with a noop test event
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL");
    if (supaUrl) {
      const ping = await fetch(`${supaUrl}/functions/v1/meta-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "PageView",
          event_id: `health_${Date.now()}`,
          test_event_code: "TEST00000",
        }),
      });
      capiActive = ping.ok;
    }
  } catch {
    capiActive = false;
  }

  // Ensure all tracked keys exist
  for (const ev of TRACKED) totals[ev] = totals[ev] || 0;

  return json({
    range: { days, since, until },
    totals,
    daily,
    capi: { active: capiActive },
    meta_error: metaError,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
