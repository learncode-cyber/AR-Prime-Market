import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verifies a cron/internal-service caller.
 *
 * This consolidates a pattern that was previously duplicated with small
 * variations across `src/routes/api/public/cron/*.ts` and multiple
 * Supabase edge functions (`daily-ceo-report`, `ad-performance-monitor`,
 * `ai-learning-engine`, `agent-research-loop`, `telegram-notify`): accept a
 * secret from either the `CRON_SECRET` env var OR the admin-rotatable
 * `integration_secrets(provider='cron')` row, checked against one of
 * `x-cron-secret`, `Authorization: Bearer`, or `apikey` headers.
 *
 * Behavior is intentionally identical to the pre-existing per-route logic
 * (see `zero-trust-scan.ts`'s original implementation) — this is a
 * consolidation, not a behavior change.
 */
export async function verifyCronRequest(request: Request): Promise<boolean> {
  const envSecret = process.env.CRON_SECRET;
  let dbSecret: string | undefined;
  try {
    const { data } = await supabaseAdmin
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "cron")
      .maybeSingle();
    dbSecret = data?.api_key ?? undefined;
  } catch {
    /* integration_secrets lookup failing must not block a validly-configured
       env-secret cron call — fall through and rely on envSecret only. */
  }

  const provided =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("apikey");

  const accepted = [envSecret, dbSecret].filter(Boolean) as string[];
  return Boolean(provided) && accepted.length > 0 && accepted.includes(provided as string);
}
