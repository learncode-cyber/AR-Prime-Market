// Shared CRON secret verifier. Accepts EITHER:
//   - env CRON_SECRET
//   - public.integration_secrets row where provider='cron'
// This avoids 401 loops when env and DB drift apart.
// @ts-nocheck
export async function verifyCronSecret(provided: string, admin: any): Promise<boolean> {
  if (!provided) return false;
  const env = Deno.env.get("CRON_SECRET") || "";
  if (env && provided === env) return true;
  try {
    const { data } = await admin
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "cron")
      .maybeSingle();
    if (data?.api_key && provided === data.api_key) return true;
  } catch {
    /* ignore */
  }
  return false;
}
