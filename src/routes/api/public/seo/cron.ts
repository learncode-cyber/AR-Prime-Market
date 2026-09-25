import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSeoScanCore } from "@/lib/seo-scan.server";
import { withGateway } from "@/lib/gateway";

export const Route = createFileRoute("/api/public/seo/cron")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "seo.cron", auth: "cron" }, async () => {
        const { data: flag } = await supabaseAdmin
          .from("feature_flags")
          .select("is_enabled")
          .eq("key", "seo_auto_rescan")
          .maybeSingle();
        if (flag?.is_enabled === false) return new Response(null, { status: 204 });

        try {
          const result = await runSeoScanCore({ trigger: "cron" });
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("seo cron error", e);
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
    },
  },
});
