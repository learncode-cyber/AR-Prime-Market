// Public-ish multipart upload endpoint for R2. Auth is enforced by requiring
// a valid Supabase access token in the Authorization header.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildR2Key, getR2Config, r2PutObject, verifyR2PublicUrl } from "@/lib/r2.server";

const MAX_BYTES = 25 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
]);

// Magic-number sniff (first bytes) for the allowed MIME types.
function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  if (
    b.length >= 12 &&
    b[4] === 0x66 &&
    b[5] === 0x74 &&
    b[6] === 0x79 &&
    b[7] === 0x70 &&
    b[8] === 0x61 &&
    b[9] === 0x76 &&
    b[10] === 0x69 &&
    b[11] === 0x66
  )
    return "image/avif";
  if (
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d
  )
    return "application/pdf";
  // SVG: text-based; check for "<svg" or "<?xml" prefix.
  if (b.length >= 5) {
    const head = new TextDecoder("utf-8", { fatal: false })
      .decode(b.subarray(0, Math.min(256, b.length)))
      .trimStart()
      .toLowerCase();
    if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
      return "image/svg+xml";
  }
  return null;
}

async function requireAdmin(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceKey) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  // Verify admin role using service-role client (bypasses RLS recursion).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return null;
  return data.user.id;
}

export const Route = createFileRoute("/api/r2-upload")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const userId = await requireAdmin(request);
        if (!userId) return json({ error: "Forbidden: admin role required" }, 403);

        const cfg = getR2Config();
        if (!cfg) return json({ error: "R2 is not configured on the server" }, 500);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Invalid multipart body" }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "Missing 'file' field" }, 400);
        if (file.size > MAX_BYTES) {
          return json(
            { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 25MB)` },
            413,
          );
        }
        const rawPrefix = (form.get("prefix") as string | null) || "uploads";
        const prefix = rawPrefix.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120) || "uploads";

        const bytes = new Uint8Array(await file.arrayBuffer());
        const sniffed = sniffMime(bytes);
        if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
          return json(
            { error: "Unsupported file type. Allowed: jpeg, png, webp, gif, avif, svg, pdf." },
            415,
          );
        }
        // Never trust browser-supplied content-type — use sniffed value.
        const contentType = sniffed;
        const key = buildR2Key({ prefix, filename: file.name || "upload.bin" });

        try {
          const url = await r2PutObject(cfg, key, bytes, contentType);
          verifyR2PublicUrl(url)
            .then((ok) => {
              if (!ok) console.warn("[r2-upload] R2 public URL not reachable yet:", url);
            })
            .catch(() => {});
          return json({ url, key, provider: "r2" });
        } catch (e: unknown) {
          return json(
            { error: (e instanceof Error ? e.message : String(e)) || "Upload failed" },
            502,
          );
        }
      },
    },
  },
});
