import { createFileRoute } from "@tanstack/react-router";
import { runZeroTrustScan } from "@/lib/zero-trust.server";
import { withGateway } from "@/lib/gateway";

// Cron endpoint — authenticated by CRON_SECRET env or admin-rotated
// integration_secrets(provider='cron'). Anon key is NEVER accepted.
// Migrated to the API Gateway (Module 2) — see docs/architecture/API_GATEWAY.md.
export const Route = createFileRoute("/api/public/cron/zero-trust-scan")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "cron.zero-trust-scan", auth: "cron" }, async () => {
        const summary = await runZeroTrustScan("cron");
        return Response.json({ ok: true, summary });
      }),
    },
  },
});
