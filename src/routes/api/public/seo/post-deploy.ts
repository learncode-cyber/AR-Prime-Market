import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSeoScanCore } from "@/lib/seo-scan.server";
import { withGateway } from "@/lib/gateway";

async function isEnabled(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("feature_flags")
    .select("is_enabled")
    .eq("key", "seo_auto_rescan")
    .maybeSingle();
  return data?.is_enabled !== false;
}

export const Route = createFileRoute("/api/public/seo/post-deploy")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "seo.post-deploy", auth: "cron" }, async ({ request }) => {
        if (!(await isEnabled())) {
          return new Response(null, { status: 204 });
        }

        let deployId: string | null = null;
        try {
          const body = (await request.json().catch(() => null)) as { deploy_id?: string } | null;
          deployId = body?.deploy_id ?? null;
        } catch {
          /* non-fatal: fall through to default (feature enabled) */
        }

        try {
          const result = await runSeoScanCore({ trigger: "deploy", deployId });
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("seo post-deploy error", e);
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
    },
  },
});
