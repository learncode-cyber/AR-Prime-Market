import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withGateway } from "@/lib/gateway";

/**
 * Health check for external uptime monitors (UptimeRobot, Better Stack,
 * Pingdom, etc. — all work over plain HTTPS, no Docker/agent required, so
 * this fits the Hostinger Business Plan hosting constraint with zero new
 * infrastructure). Checks that the process is up AND that it can reach
 * Supabase — a 200 with `db: "ok"` means the whole request path works, not
 * just that the Node process is alive.
 *
 * Deliberately public (auth: "public") and cheap — uptime monitors poll
 * this every 1-5 minutes from possibly-changing IPs; requiring auth or
 * rate-limiting it defeats the purpose.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: withGateway({ routeName: "health", auth: "public" }, async () => {
        const startedAt = Date.now();
        let dbStatus: "ok" | "error" = "ok";
        try {
          const { error } = await supabaseAdmin.from("products").select("id").limit(1);
          if (error) dbStatus = "error";
        } catch {
          dbStatus = "error";
        }

        const body = {
          status: dbStatus === "ok" ? "ok" : "degraded",
          db: dbStatus,
          latencyMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(body), {
          status: dbStatus === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      }),
    },
  },
});
