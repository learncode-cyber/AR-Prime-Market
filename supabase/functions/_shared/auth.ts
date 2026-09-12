// Shared auth helpers for edge functions.
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

// Verifies request has a valid admin JWT. Returns { ok, userId } or Response on failure.
export async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonError("Unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonError("Unauthorized", 401);

  const admin = adminClient();
  const { data: isAdmin } = await admin.rpc("has_role", {
    p_user: userData.user.id,
    p_role: "admin",
  });
  if (!isAdmin) return jsonError("Forbidden", 403);
  return { ok: true, userId: userData.user.id };
}

// Verifies a CRON_SECRET-style header. Accepts env CRON_SECRET or integration_secrets(provider='cron').
export async function requireCronOrAdmin(req: Request): Promise<{ ok: true } | Response> {
  const provided = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret") || "";
  const envSecret = Deno.env.get("CRON_SECRET") || "";

  if (provided && envSecret && provided === envSecret) return { ok: true };

  // Try integration_secrets fallback
  try {
    const admin = adminClient();
    const { data } = await admin
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "cron")
      .maybeSingle();
    if (provided && data?.api_key && provided === data.api_key) return { ok: true };
  } catch {
    /* ignore */
  }

  // Fall back to admin JWT
  const adminCheck = await requireAdmin(req);
  if ("ok" in adminCheck) return { ok: true };
  return adminCheck;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
