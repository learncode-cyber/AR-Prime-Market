import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildR2Key, getR2Config, r2PutObject, verifyR2PublicUrl } from "@/lib/r2.server";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap

const InputSchema = z.object({
  base64: z
    .string()
    .min(8)
    .max(25 * 1024 * 1024),
  filename: z.string().min(1).max(200),
  contentType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
  fallbackBucket: z.enum([
    "avatars",
    "return-images",
    "blog-images",
    "product-images",
    "category-images",
  ]),
  fallbackPath: z.string().min(1).max(500),
  // When true, skip R2 and use Supabase Storage instead (admin escape hatch).
  forceFallback: z.boolean().optional(),
  // Reserved for callers that want strict R2-only behavior.
  disableFallback: z.boolean().optional(),
});

const PRIVATE_BUCKETS = new Set(["return-images"]);

function stripDataPrefix(input: string) {
  const idx = input.indexOf(",");
  if (input.startsWith("data:") && idx !== -1) return input.slice(idx + 1);
  return input;
}

async function fallbackStorageUpload(
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  if (PRIVATE_BUCKETS.has(bucket)) {
    return path;
  }
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

const ADMIN_ONLY_BUCKETS = new Set(["product-images", "blog-images", "category-images"]);

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (ADMIN_ONLY_BUCKETS.has(data.fallbackBucket)) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) throw new Error("Forbidden: admin role required for this bucket");
    } else if (data.fallbackBucket === "avatars" || data.fallbackBucket === "return-images") {
      const requiredPrefix = `${context.userId}/`;
      const normalized = data.fallbackPath.replace(/^\/+/, "");
      if (
        !normalized.startsWith(requiredPrefix) ||
        normalized.includes("..") ||
        normalized.includes("//")
      ) {
        throw new Error("Forbidden: upload path must be within your own folder");
      }
      data.fallbackPath = normalized;
    }

    const rawB64 = stripDataPrefix(data.base64);
    const approxBytes = Math.floor((rawB64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      throw new Error(`Image too large (${(approxBytes / 1024 / 1024).toFixed(1)}MB, max 15MB)`);
    }
    const bytes = Buffer.from(rawB64, "base64");

    // Cloudflare R2 is the ONLY destination. Supabase Storage fallback is
    // only used when the admin explicitly forces it via `forceFallback`.
    if (!data.forceFallback) {
      const r2 = getR2Config();
      if (!r2) {
        throw new Error(
          "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_CUSTOM_DOMAIN in project secrets.",
        );
      }
      const key = buildR2Key({
        prefix: data.fallbackBucket,
        filename: data.filename,
      });
      const url = await r2PutObject(r2, key, bytes, data.contentType);
      // Best-effort reachability check; do not block the upload if it fails.
      verifyR2PublicUrl(url)
        .then((ok) => {
          if (!ok) console.warn("[uploadImage] R2 public URL not reachable yet:", url);
        })
        .catch(() => {});
      return { url, provider: "r2" as const, imgbbError: undefined };
    }

    // Explicit fallback path (admin "Use Supabase Storage" button).
    const url = await fallbackStorageUpload(
      data.fallbackBucket,
      data.fallbackPath,
      bytes,
      data.contentType,
    );
    return { url, provider: "supabase" as const, imgbbError: undefined };
  });
