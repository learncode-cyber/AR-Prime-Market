// @ts-nocheck
// Supabase Edge Function: test-credentials
// Validates saved API credentials by performing a minimal auth call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function loadCreds(provider: string) {
  const { data, error } = await admin
    .from("api_credentials")
    .select("credentials")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.credentials) throw new Error("No credentials saved");
  return data.credentials as Record<string, string>;
}

async function testCJ() {
  const c = await loadCreds("cj_dropshipping");
  if (!c.email || !c.password) throw new Error("email and password are required");
  const r = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, password: c.password }),
    },
  );
  const j = await r.json().catch(() => ({}));
  if (j?.data?.accessToken) return "CJ access token retrieved";
  throw new Error(j?.message || `HTTP ${r.status}`);
}

async function testAliExpress() {
  const c = await loadCreds("aliexpress");
  if (!c.app_key || !c.access_token) throw new Error("app_key and access_token are required");
  const params = new URLSearchParams({
    method: "aliexpress.ds.recommend.feed.get",
    app_key: c.app_key,
    access_token: c.access_token,
    feed_name: "DS_RECOMMEND_TO_YOU",
    page_no: "1",
    page_size: "1",
    target_currency: "USD",
  });
  const r = await fetch(`https://api-sg.aliexpress.com/sync?${params}`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  const err = j?.error_response;
  if (err) throw new Error(err.msg || err.sub_msg || "AliExpress rejected the call");
  return "AliExpress credentials accepted";
}

async function testSteadfast() {
  const c = await loadCreds("steadfast");
  if (!c.api_key || !c.secret_key) throw new Error("api_key and secret_key are required");
  const r = await fetch("https://portal.steadfast.com.bd/api/v1/get_balance", {
    headers: {
      "Api-Key": c.api_key,
      "Secret-Key": c.secret_key,
      "Content-Type": "application/json",
    },
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 200 && (j?.status === 200 || typeof j?.current_balance !== "undefined")) {
    return `SteadFast balance: ${j.current_balance ?? "ok"}`;
  }
  throw new Error(j?.message || `HTTP ${r.status}`);
}

async function testGemini() {
  const c = await loadCreds("gemini");
  if (!c.api_key) throw new Error("api_key is required");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(c.api_key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
    },
  );
  const j = await r.json().catch(() => ({}));
  if (r.status === 200 && j?.candidates) return "Gemini key accepted";
  throw new Error(j?.error?.message || `HTTP ${r.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Admin-only
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, message: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ ok: false, message: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { p_user: u.user.id, p_role: "admin" });
    if (!isAdmin) return json({ ok: false, message: "Forbidden" }, 403);

    const { provider } = await req.json().catch(() => ({}));
    if (!provider) return json({ ok: false, message: "provider required" }, 400);

    let message: string;
    if (provider === "cj_dropshipping") message = await testCJ();
    else if (provider === "aliexpress") message = await testAliExpress();
    else if (provider === "steadfast") message = await testSteadfast();
    else if (provider === "gemini") message = await testGemini();
    else return json({ ok: false, message: "Unknown provider" }, 400);

    await admin
      .from("api_credentials")
      .update({ updated_at: new Date().toISOString() })
      .eq("provider", provider);

    return json({ ok: true, message });
  } catch (e) {
    return json({ ok: false, message: (e as Error).message });
  }
});
