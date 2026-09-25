import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Called by pg_cron every minute. Picks due queue rows and (in mock mode)
// inserts a voice_call_logs row in "ringing" status. Real provider integration
// would replace the mock block with an HTTP call to Twilio/Vapi.
export const Route = createFileRoute("/api/public/voice/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: CRON_SECRET or integration_secrets(provider='cron')
        const envSecret = process.env.CRON_SECRET;
        let dbSecret: string | undefined;
        try {
          const { data } = await supabaseAdmin
            .from("integration_secrets")
            .select("api_key")
            .eq("provider", "cron")
            .maybeSingle();
          dbSecret = data?.api_key ?? undefined;
        } catch {}
        const provided =
          request.headers.get("x-cron-secret") ||
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const accepted = [envSecret, dbSecret].filter(Boolean) as string[];
        if (!provided || !accepted.includes(provided)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabaseAdmin
          .from("voice_agent_settings")
          .select("enabled, script_template")
          .limit(1)
          .maybeSingle();

        const { data: due } = await supabaseAdmin
          .from("voice_call_queue")
          .select("id, order_id, attempts")
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .limit(25);

        if (!due || due.length === 0) {
          return Response.json({ processed: 0, skipped: 0 });
        }

        // If agent is OFF: mark queue rows skipped and stop.
        if (!settings?.enabled) {
          await supabaseAdmin
            .from("voice_call_queue")
            .update({ status: "skipped", last_error: "agent disabled" })
            .in(
              "id",
              due.map((d) => d.id),
            );
          return Response.json({ processed: 0, skipped: due.length });
        }

        let processed = 0;
        for (const q of due) {
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, customer_name, customer_phone, total_amount, currency")
            .eq("id", q.order_id)
            .maybeSingle();
          if (!order) {
            await supabaseAdmin
              .from("voice_call_queue")
              .update({ status: "failed", last_error: "order missing" })
              .eq("id", q.id);
            continue;
          }
          const script = (settings.script_template || "")
            .replaceAll("{{customer_name}}", order.customer_name || "customer")
            .replaceAll("{{total_price}}", String(order.total_amount ?? 0));

          // MOCK provider: log it as if the call is now ringing.
          await supabaseAdmin.from("voice_call_logs").insert({
            order_id: order.id,
            phone: order.customer_phone,
            customer_name: order.customer_name,
            script,
            provider: "mock",
            status: "ringing",
          });

          await supabaseAdmin
            .from("voice_call_queue")
            .update({ status: "sent", attempts: (q.attempts ?? 0) + 1 })
            .eq("id", q.id);
          processed++;
        }

        return Response.json({ processed, skipped: 0 });
      },
    },
  },
});
