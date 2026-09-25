import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  updated_at: string;
};

export const getFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("key, label, description, category, is_enabled, updated_at")
      .order("category", { ascending: true })
      .order("label", { ascending: true });
    if (error) {
      console.error("getFeatureFlags error:", error);
      return { flags: [] as FeatureFlag[], error: error.message };
    }
    return { flags: (data ?? []) as FeatureFlag[], error: null };
  });

export const updateFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        is_enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow, error: roleErr } = await context.supabase.rpc("has_role", {
      p_user: context.userId,
      p_role: "admin",
    });
    if (roleErr || !roleRow) {
      throw new Error("Forbidden: admin role required");
    }
    const { error } = await context.supabase
      .from("feature_flags")
      .update({ is_enabled: data.is_enabled })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpdateFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        category: z.string().min(1).max(64),
        is_enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow, error: roleErr } = await context.supabase.rpc("has_role", {
      p_user: context.userId,
      p_role: "admin",
    });
    if (roleErr || !roleRow) {
      throw new Error("Forbidden: admin role required");
    }
    const { error } = await context.supabase
      .from("feature_flags")
      .update({ is_enabled: data.is_enabled })
      .eq("category", data.category);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
