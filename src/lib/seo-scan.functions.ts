import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSeoScanCore } from "./seo-scan.server";

async function assertAdmin(ctx: { userId: string }) {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    p_user: ctx.userId,
    p_role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const runSeoScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const result = await runSeoScanCore({ trigger: "manual" });
    return result;
  });

export const triggerSeoCron = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const result = await runSeoScanCore({ trigger: "cron" });
    return result;
  });

export const getLatestScan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: run } = await supabaseAdmin
      .from("seo_scan_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) return { run: null, findings: [] };
    const { data: findings } = await supabaseAdmin
      .from("seo_scan_findings")
      .select("*")
      .eq("run_id", run.id)
      .order("severity", { ascending: true });
    return { run, findings: findings ?? [] };
  });

export const listScanHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await supabaseAdmin
      .from("seo_scan_runs")
      .select("id, started_at, finished_at, trigger, score, pass_count, warn_count, fail_count")
      .order("started_at", { ascending: false })
      .limit(30);
    return { runs: data ?? [] };
  });

export const getScanConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await supabaseAdmin.from("seo_scan_config").select("*").limit(1).maybeSingle();
    return { config: data };
  });

export const updateScanConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        auto_rescan_enabled: z.boolean().optional(),
        schedule_cron: z.string().min(5).max(64).optional(),
        target_urls: z.array(z.string().min(1).max(256)).max(50).optional(),
        pagespeed_enabled: z.boolean().optional(),
        base_url: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: existing } = await supabaseAdmin
      .from("seo_scan_config")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin
        .from("seo_scan_config")
        .insert({ ...data, singleton: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("seo_scan_config")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
