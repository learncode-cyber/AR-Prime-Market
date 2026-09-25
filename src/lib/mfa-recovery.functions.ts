import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, randomBytes } from "crypto";

function generateCode(): string {
  // 10 hex chars grouped as XXXXX-XXXXX
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex");
}

export const generateRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const codes = Array.from({ length: 10 }, () => generateCode());
    const rows = codes.map((c) => ({ user_id: userId, code_hash: hashCode(c) }));

    // Replace existing codes
    const { error: delErr } = await supabaseAdmin
      .from("mfa_recovery_codes")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin.from("mfa_recovery_codes").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { codes };
  });

export const getRecoveryCodesStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("mfa_recovery_codes")
      .select("used_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const total = data?.length ?? 0;
    const used = data?.filter((r) => r.used_at).length ?? 0;
    return { total, remaining: total - used };
  });
