// Meta Conversions API (CAPI) — server-side mirror for browser Pixel events.
// Accepts POST { event_name, event_id, event_time?, event_source_url?,
// custom_data?, user_data? } and forwards to Meta's Graph API with hashed PII.
// Dedupes with browser Pixel via shared event_id.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const META_API_VERSION = "v21.0";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normalize = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

async function hashIf(value: unknown): Promise<string | undefined> {
  const n = normalize(value);
  if (!n) return undefined;
  return await sha256(n);
}

async function hashPhone(value: unknown): Promise<string | undefined> {
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  return await sha256(digits);
}

function getClientIp(req: Request): string | undefined {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || undefined;
}

interface IncomingEvent {
  event_name: string;
  event_id?: string;
  event_time?: number;
  event_source_url?: string;
  action_source?: string;
  custom_data?: Record<string, unknown>;
  user_data?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    external_id?: string;
    fbp?: string;
    fbc?: string;
  };
  test_event_code?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: accept (a) internal shared-secret, (b) admin JWT, or (c) browser request
  // whose Origin matches an allowed host (prevents server-side spoofing while
  // letting first-party shoppers send legitimate pixel events).
  const internalSecret = Deno.env.get("CRON_SECRET") || "";
  const providedSecret = req.headers.get("x-internal-secret") || "";
  const hasInternal = !!internalSecret && providedSecret === internalSecret;

  if (!hasInternal) {
    const origin = req.headers.get("origin") || "";
    const allowedExtra = (Deno.env.get("META_CAPI_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let host = "";
    try {
      host = origin ? new URL(origin).hostname : "";
    } catch {
      host = "";
    }
    const originOk = !!host && (allowedExtra.includes(origin) || allowedExtra.includes(host));

    if (!originOk) {
      const { requireAdmin } = await import("../_shared/auth.ts");
      const auth = await requireAdmin(req);
      if (auth instanceof Response) return auth;
    }
  }

  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const pixelId = Deno.env.get("META_PIXEL_ID");

  if (!accessToken || !pixelId) {
    return new Response(
      JSON.stringify({ error: "META_ACCESS_TOKEN or META_PIXEL_ID not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: IncomingEvent;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload?.event_name || typeof payload.event_name !== "string") {
    return new Response(JSON.stringify({ error: "event_name required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ud = payload.user_data || {};
  const clientIp = getClientIp(req);
  const clientUserAgent = req.headers.get("user-agent") || undefined;

  const hashedUserData: Record<string, unknown> = {};
  const em = await hashIf(ud.email);
  if (em) hashedUserData.em = [em];
  const ph = await hashPhone(ud.phone);
  if (ph) hashedUserData.ph = [ph];
  const fn = await hashIf(ud.first_name);
  if (fn) hashedUserData.fn = [fn];
  const ln = await hashIf(ud.last_name);
  if (ln) hashedUserData.ln = [ln];
  const ct = await hashIf(ud.city);
  if (ct) hashedUserData.ct = [ct];
  const st = await hashIf(ud.state);
  if (st) hashedUserData.st = [st];
  const country = await hashIf(ud.country);
  if (country) hashedUserData.country = [country];
  const zp = await hashIf(ud.zip);
  if (zp) hashedUserData.zp = [zp];
  const ext = await hashIf(ud.external_id);
  if (ext) hashedUserData.external_id = [ext];

  if (clientIp) hashedUserData.client_ip_address = clientIp;
  if (clientUserAgent) hashedUserData.client_user_agent = clientUserAgent;
  if (ud.fbp) hashedUserData.fbp = ud.fbp;
  if (ud.fbc) hashedUserData.fbc = ud.fbc;

  const event = {
    event_name: payload.event_name,
    event_time: payload.event_time || Math.floor(Date.now() / 1000),
    event_id: payload.event_id,
    event_source_url: payload.event_source_url,
    action_source: payload.action_source || "website",
    user_data: hashedUserData,
    custom_data: payload.custom_data || {},
  };

  const body: Record<string, unknown> = { data: [event] };
  if (payload.test_event_code) body.test_event_code = payload.test_event_code;

  const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const metaJson = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      console.error("[meta-capi] Meta error", metaRes.status, metaJson);
      return new Response(
        JSON.stringify({ error: "Meta CAPI error", status: metaRes.status, details: metaJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true, meta: metaJson, event_id: event.event_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-capi] Network error", err);
    return new Response(
      JSON.stringify({ error: "Network error", message: (err as Error).message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
