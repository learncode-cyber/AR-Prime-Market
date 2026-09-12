import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LogInput = z.object({
  table_name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z_][a-z0-9_]*$/),
  fields: z.array(z.string().min(1).max(64)).min(1).max(20),
  record_ids: z.array(z.string().uuid()).max(500).optional(),
  context: z.string().max(200).optional(),
  row_count: z.number().int().min(0).max(100000).optional(),
});

export const logSensitiveAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LogInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ||
      req?.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      null;
    const ua = req?.headers.get("user-agent")?.slice(0, 500) || null;

    const { error } = await supabase.from("sensitive_field_access_logs").insert({
      user_id: userId,
      table_name: data.table_name,
      fields: data.fields,
      record_ids: data.record_ids ?? [],
      context: data.context ?? null,
      row_count: data.row_count ?? data.record_ids?.length ?? 0,
      ip_address: ip,
      user_agent: ua,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListInput = z.object({
  limit: z.number().int().min(1).max(50000).optional(),
  table_name: z.string().max(64).optional(),
  user_id: z.string().uuid().optional(),
});

export const listSensitiveAccessLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Admin check via has_role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      p_user: userId,
      p_role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    let q = supabase
      .from("sensitive_field_access_logs")
      .select(
        "id, user_id, table_name, fields, record_ids, context, row_count, ip_address, user_agent, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.table_name) q = q.eq("table_name", data.table_name);
    if (data.user_id) q = q.eq("user_id", data.user_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Enrich with email/name via profiles
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let profiles: Record<string, { email: string | null; full_name: string | null }> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids);
      profiles = Object.fromEntries(
        (profs ?? []).map((p: { id: string; email: string | null; full_name: string | null }) => [
          p.id,
          { email: p.email, full_name: p.full_name },
        ]),
      );
    }

    return {
      logs: (rows ?? []).map((r) => ({
        ...r,
        user_email: profiles[r.user_id]?.email ?? null,
        user_name: profiles[r.user_id]?.full_name ?? null,
      })),
    };
  });
