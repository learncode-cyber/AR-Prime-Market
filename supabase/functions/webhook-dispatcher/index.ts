// Edge Function: webhook-dispatcher
// Dispatches an event payload to every active webhook subscribed to event_type,
// logs the response to webhook_delivery_logs, and signs the body if a secret exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: CRON_SECRET header OR admin JWT
    const provided = req.headers.get("x-cron-secret") || "";
    const envSecret = Deno.env.get("CRON_SECRET") || "";
    let authorized = !!(provided && envSecret && provided === envSecret);
    if (!authorized) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const ANON_KEY =
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await userClient.auth.getUser();
        if (u?.user) {
          const { data: isAdmin } = await admin.rpc("has_role", {
            p_user: u.user.id,
            p_role: "admin",
          });
          if (isAdmin) authorized = true;
        }
      }
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const { event_type, payload } = await req.json();
    if (!event_type) return json({ error: "event_type required" }, 400);

    const { data: hooks } = await admin
      .from("webhooks")
      .select("id, target_url, event_types")
      .eq("is_active", true);
    const matched = (hooks || []).filter((h: any) => (h.event_types || []).includes(event_type));

    const body = JSON.stringify({ event_type, payload, timestamp: new Date().toISOString() });
    const results: any[] = [];

    for (const hook of matched) {
      const { data: sec } = await admin
        .from("webhook_secrets")
        .select("secret")
        .eq("webhook_id", hook.id)
        .maybeSingle();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Event-Type": event_type,
      };
      if (sec?.secret) {
        const sig = createHmac("sha256", sec.secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = sig;
      }
      let status = 0;
      let respBody = "";
      try {
        const r = await fetch(hook.target_url, { method: "POST", headers, body });
        status = r.status;
        respBody = (await r.text()).slice(0, 2000);
      } catch (e) {
        respBody = `fetch error: ${String(e)}`;
      }
      await admin.from("webhook_delivery_logs").insert({
        webhook_id: hook.id,
        event_type,
        payload,
        response_status: status,
        response_body: respBody,
        delivered_at: new Date().toISOString(),
      });
      results.push({ webhook_id: hook.id, status });
    }

    return json({ dispatched: results.length, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
