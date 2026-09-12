import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildR2Key, getR2Config, r2PutObject, verifyR2PublicUrl } from "@/lib/r2.server";
import { requireAdmin } from "@/lib/server-auth";

const MAX_BYTES = 25 * 1024 * 1024;

const InputSchema = z.object({
  base64: z
    .string()
    .min(8)
    .max(40 * 1024 * 1024),
  filename: z.string().min(1).max(200),
  contentType: z
    .string()
    .regex(/^[a-zA-Z0-9.+\-]+\/[a-zA-Z0-9.+\-]+$/)
    .max(100),
  prefix: z
    .string()
    .max(120)
    .regex(/^[a-zA-Z0-9/_-]*$/)
    .optional(),
});

function stripDataPrefix(input: string) {
  const idx = input.indexOf(",");
  if (input.startsWith("data:") && idx !== -1) return input.slice(idx + 1);
  return input;
}

export const r2IsConfigured = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: !!getR2Config() };
});

export const uploadToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // SECURITY (fixed 2026-07): this was previously reachable by any
    // logged-in user — only requireSupabaseAuth (any session) gated it,
    // not admin role — despite being an admin-only tool (its only caller
    // is kali_master.hero.tsx's hero-banner uploader). A customer account
    // could have called this directly to upload arbitrary files (up to
    // 25MB) to R2 storage and get a public URL back.
    await requireAdmin(context.supabase, context.userId);

    const cfg = getR2Config();
    if (!cfg) throw new Error("R2 is not configured on the server");

    const rawB64 = stripDataPrefix(data.base64);
    const approxBytes = Math.floor((rawB64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      throw new Error(`File too large (${(approxBytes / 1024 / 1024).toFixed(1)}MB, max 25MB)`);
    }

    const bytes = Buffer.from(rawB64, "base64");
    const key = buildR2Key({ prefix: data.prefix, filename: data.filename });
    const url = await r2PutObject(cfg, key, bytes, data.contentType);
    verifyR2PublicUrl(url)
      .then((ok) => {
        if (!ok) console.warn("[uploadToR2] R2 public URL not reachable yet:", url);
      })
      .catch(() => {});
    return { url, key, provider: "r2" as const };
  });
