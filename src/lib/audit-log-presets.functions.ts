import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALL_COLUMNS = [
  "created_at",
  "user_name",
  "user_email",
  "user_id",
  "table_name",
  "fields",
  "record_ids",
  "row_count",
  "context",
  "ip_address",
  "user_agent",
] as const;

const FiltersSchema = z.object({
  table_name: z.string().max(64).optional().nullable(),
  limit: z.number().int().min(1).max(50000).optional(),
});

const PresetInput = z.object({
  name: z.string().min(1).max(80),
  filters: FiltersSchema,
  columns: z.array(z.enum(ALL_COLUMNS)).min(1).max(ALL_COLUMNS.length),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    p_user: userId,
    p_role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

export const listExportPresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("audit_log_export_presets")
      .select("id, name, filters, columns, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { presets: data ?? [] };
  });

export const saveExportPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PresetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("audit_log_export_presets")
      .upsert(
        {
          user_id: userId,
          name: data.name,
          filters: data.filters,
          columns: data.columns,
        },
        { onConflict: "user_id,name" },
      )
      .select("id, name, filters, columns, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { preset: row };
  });

export const deleteExportPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("audit_log_export_presets")
      .delete()
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const PRESET_COLUMNS = ALL_COLUMNS;
export type PresetColumn = (typeof ALL_COLUMNS)[number];
