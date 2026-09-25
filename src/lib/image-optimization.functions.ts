import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/server-auth";

export type ImageOptimizationSettings = {
  enabled: boolean;
  format: "webp";
  quality: number; // 1-100
  max_width: number; // 0 = no resize
  skip_animated: boolean;
};

export const DEFAULT_IMAGE_OPT_SETTINGS: ImageOptimizationSettings = {
  enabled: true,
  format: "webp",
  quality: 82,
  max_width: 2000,
  skip_animated: true,
};

// Read settings — any authenticated user can call (needed for client-side
// conversion before upload). No secrets returned; pure config.
export const getImageOptimizationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageOptimizationSettings> => {
    // Hardening (2026-07): this returned no secrets (the API key itself was
    // never in the response), so this was low-severity, but it's
    // business-wide config and should still be admin-gated for consistency
    // with every other settings endpoint.
    await requireAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("integration_settings")
      .select("extra_config, is_active")
      .eq("provider", "image_optimization")
      .maybeSingle();

    const cfg = (data?.extra_config ?? {}) as Partial<ImageOptimizationSettings>;
    const active = data?.is_active ?? true;

    return {
      enabled: active && (cfg.enabled ?? DEFAULT_IMAGE_OPT_SETTINGS.enabled),
      format: "webp",
      quality: clamp(Number(cfg.quality ?? DEFAULT_IMAGE_OPT_SETTINGS.quality), 1, 100),
      max_width: Math.max(0, Number(cfg.max_width ?? DEFAULT_IMAGE_OPT_SETTINGS.max_width)),
      skip_animated: cfg.skip_animated ?? DEFAULT_IMAGE_OPT_SETTINGS.skip_animated,
    };
  });

const SettingsSchema = z.object({
  enabled: z.boolean(),
  quality: z.number().int().min(1).max(100),
  max_width: z.number().int().min(0).max(10000),
  skip_animated: z.boolean(),
});

// Admin-only write — protected by RPC's own admin check.
export const saveImageOptimizationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Use the user-scoped supabase from middleware so RLS / RPC admin check applies
    const { supabase } = context;
    const { error } = await supabase.rpc("set_integration_secret", {
      p_provider: "image_optimization",
      p_api_key: "local", // RPC requires non-empty; not used by upload code
      p_extra_config: {
        enabled: data.enabled,
        format: "webp",
        quality: data.quality,
        max_width: data.max_width,
        skip_animated: data.skip_animated,
      },
      p_activate: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
