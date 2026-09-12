import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Inbound IVR / DTMF webhook. Requires a shared secret in the
// `x-voice-secret` (or `x-cron-secret`) header. Real providers should
// additionally verify their own signed signatures (e.g. Twilio).
const Body = z.object({
  call_log_id: z.string().uuid(),
  digit: z.enum(["1", "2"]),
});

async function isAuthorized(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-voice-secret") || req.headers.get("x-cron-secret") || "";
  if (!provided) return false;

  const envSecret = process.env.VOICE_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
  if (envSecret && provided === envSecret) return true;

  try {
    const { data } = await supabaseAdmin
      .from("integration_secrets")
      .select("api_key")
      .in("provider", ["voice_webhook", "cron"]);
    return !!(data ?? []).find((row: any) => row.api_key && row.api_key === provided);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/voice/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorized(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: log } = await supabaseAdmin
          .from("voice_call_logs")
          .select("id, order_id, status")
          .eq("id", parsed.call_log_id)
          .maybeSingle();
        if (!log) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Only allow transitions on calls still awaiting customer response
        if (
          log.status &&
          !["pending", "ringing", "in_progress", "awaiting_response"].includes(log.status)
        ) {
          return new Response(JSON.stringify({ error: "Call already resolved" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        const newStatus = parsed.digit === "1" ? "confirmed" : "cancelled";
        await supabaseAdmin
          .from("voice_call_logs")
          .update({ status: newStatus, dtmf_digit: parsed.digit })
          .eq("id", log.id);

        if (parsed.digit === "1") {
          await supabaseAdmin.from("orders").update({ status: "confirmed" }).eq("id", log.order_id);
        } else {
          await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", log.order_id);
          await supabaseAdmin.from("agent_notifications").insert({
            type: "voice_agent",
            title: "Order cancelled via voice agent",
            message: `Customer pressed 2 for order ${log.order_id}.`,
          });
        }

        return Response.json({ ok: true, status: newStatus });
      },
    },
  },
});
