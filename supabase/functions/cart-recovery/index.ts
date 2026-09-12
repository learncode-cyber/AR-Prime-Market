// Edge Function: cart-recovery
// Persists cart snapshots to abandoned_carts and marks recovered.
// Actions: persist_cart | mark_recovered.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await userClient.auth.getUser();
  return data?.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, user_id, session_id, email, cart_items, subtotal, currency } = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const callerId = await getCallerUserId(req);

    // If caller supplied a user_id, they must be authenticated as that user
    if (user_id) {
      if (!callerId || callerId !== user_id) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    if (action === "mark_recovered") {
      if (user_id) {
        await admin.from("abandoned_carts").delete().eq("user_id", user_id);
      }
      return json({ success: true });
    }

    if (action === "persist_cart") {
      if (!cart_items || cart_items.length === 0) return json({ success: true, skipped: "empty" });
      const cartBlob = { items: cart_items, subtotal, currency, email, session_id };
      if (user_id) {
        // Upsert by user_id (single open cart)
        const { data: existing } = await admin
          .from("abandoned_carts")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();
        if (existing) {
          await admin
            .from("abandoned_carts")
            .update({ cart: cartBlob, abandoned_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await admin.from("abandoned_carts").insert({
            user_id,
            cart: cartBlob,
            abandoned_at: new Date().toISOString(),
          });
        }
      } else {
        // Guest cart: store as anonymous row (user_id null)
        await admin.from("abandoned_carts").insert({
          user_id: null,
          cart: cartBlob,
          abandoned_at: new Date().toISOString(),
        });
      }
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
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
