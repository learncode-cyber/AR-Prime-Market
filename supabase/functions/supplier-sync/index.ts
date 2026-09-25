// Edge Function: supplier-sync
// Triggers an external supplier import or stamps last_sync_at as a no-op when
// no api_endpoint is configured. Admin-callable via verify_jwt + has_role check.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { p_user: user.id, p_role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { supplier_id } = await req.json();
    if (!supplier_id) return json({ error: "supplier_id required" }, 400);

    const { data: supplier, error: supErr } = await admin
      .from("suppliers")
      .select("*")
      .eq("id", supplier_id)
      .maybeSingle();
    if (supErr || !supplier) return json({ error: "Supplier not found" }, 404);

    let synced = 0;
    let note = "no api_endpoint configured; stamped last_sync_at only";

    if (supplier.api_endpoint) {
      try {
        const apiKey = supplier.api_key_ref
          ? (
              await admin
                .from("integration_secrets")
                .select("api_key")
                .eq("provider", supplier.api_key_ref)
                .maybeSingle()
            ).data?.api_key
          : null;
        const resp = await fetch(supplier.api_endpoint, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (resp.ok) {
          const body = await resp.json();
          const items: any[] = Array.isArray(body) ? body : body.products || body.items || [];
          synced = items.length;
          note = `fetched ${synced} items from supplier endpoint`;
        } else {
          note = `supplier endpoint returned ${resp.status}`;
        }
      } catch (e) {
        note = `fetch failed: ${String(e)}`;
      }
    }

    await admin
      .from("suppliers")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", supplier_id);
    return json({ success: true, synced, note });
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
