import { createFileRoute } from "@tanstack/react-router";
import { runBlogGeneration } from "@/lib/blog-ai.server";
import { withGateway } from "@/lib/gateway";

// Cron endpoint — authenticated by a dedicated server-only secret.
// Prefer CRON_SECRET (long random). Falls back to legacy anon key only if
// CRON_SECRET is not set, to avoid breaking existing schedules during rollover.
// Migrated to the API Gateway (Module 2) — see docs/architecture/API_GATEWAY.md.
export const Route = createFileRoute("/api/public/cron/generate-blog")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "cron.generate-blog", auth: "cron" }, async () => {
        try {
          const result = await runBlogGeneration("cron");
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: unknown) {
          console.error("[cron generate-blog]", e);
          const message = e instanceof Error ? e.message : "Failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
    },
  },
});
