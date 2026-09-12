import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildR2Key, getR2Config, r2HeadObject, r2PublicUrl, r2PutObject } from "@/lib/r2.server";

export const SUPABASE_BUCKETS = [
  "product-images",
  "blog-images",
  "category-images",
  "avatars",
  "return-images",
] as const;

export type Bucket = (typeof SUPABASE_BUCKETS)[number];

const URL_COLUMNS: { table: string; column: string; isArray?: boolean }[] = [
  { table: "products", column: "gallery_urls", isArray: true },
  { table: "product_images", column: "url" },
  { table: "categories", column: "image_url" },
  { table: "blog_posts", column: "featured_image_url" },
  { table: "profiles", column: "avatar_url" },
  { table: "home_category_card_items", column: "image_url" },
  { table: "order_items", column: "image_url" },
];

type StorageListItem = {
  id?: string | null;
  name: string;
  metadata?: { size?: number; mimetype?: string; [key: string]: unknown } | null;
};

type BatchInput = {
  bucket: Bucket;
  limit: number;
};

async function requireAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("[requireAdmin] query error for userId", userId, error);
    throw new Error(`Admin check failed: ${error.message}`);
  }

  if (!data) {
    console.error("[requireAdmin] no admin row for userId", userId);
    throw new Error(`Forbidden: admin role required (uid=${userId})`);
  }
}

async function logEvent(row: {
  event_type: string;
  bucket?: string;
  source_path?: string;
  destination_url?: string;
  r2_key?: string;
  status: string;
  attempts?: number;
  size_bytes?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("storage_logs").insert(row as any);
}

function joinStoragePath(prefix: string, name: string) {
  return prefix ? `${prefix.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}` : name;
}

function isFolderEntry(item: StorageListItem) {
  return !item.id && !item.metadata?.mimetype && item.metadata?.size == null;
}

function isMigratableFile(path: string, item: StorageListItem) {
  if (!path || path.endsWith("/")) return false;
  if (path.endsWith("/.emptyFolderPlaceholder")) return false;
  if (item.metadata?.size === 0) return false;
  return !isFolderEntry(item);
}

async function listMigratableFiles(bucket: Bucket, opts: { limit?: number } = {}) {
  const files: Array<{ path: string; item: StorageListItem }> = [];
  const maxFiles = opts.limit ?? Number.POSITIVE_INFINITY;

  async function walk(prefix: string) {
    if (files.length >= maxFiles) return;

    const listed = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (listed.error)
      throw new Error(`List failed (${bucket}/${prefix || "root"}): ${listed.error.message}`);

    for (const item of (listed.data ?? []) as StorageListItem[]) {
      if (!item.name || files.length >= maxFiles) continue;
      const path = joinStoragePath(prefix, item.name);

      if (isFolderEntry(item)) {
        await walk(path);
        continue;
      }

      if (isMigratableFile(path, item)) files.push({ path, item });
    }
  }

  await walk("");
  return files;
}

export async function getStorageMigrationOverviewForUser(userId: string) {
  await requireAdmin(userId);

  const buckets: Array<{ bucket: Bucket; objectCount: number; migrated: number; failed: number }> =
    [];
  for (const bucket of SUPABASE_BUCKETS) {
    let objectCount = 0;
    try {
      objectCount = (await listMigratableFiles(bucket)).length;
    } catch (e: unknown) {
      console.warn(
        `[storage-migration] count ${bucket}:`,
        (e instanceof Error ? e.message : String(e)) || String(e),
      );
      objectCount = 0;
    }

    const { count: migrated } = await supabaseAdmin
      .from("storage_logs")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("status", "success");
    const { count: failed } = await supabaseAdmin
      .from("storage_logs")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("status", "failed");

    buckets.push({
      bucket,
      objectCount,
      migrated: migrated ?? 0,
      failed: failed ?? 0,
    });
  }

  const { data: logs } = await supabaseAdmin
    .from("storage_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return { buckets, logs: logs ?? [] };
}

export async function migrateBucketBatchForUser(data: BatchInput, userId: string) {
  await requireAdmin(userId);

  const r2 = getR2Config();
  if (!r2) throw new Error("R2 is not configured on the server");

  const bucket = data.bucket;
  const files = await listMigratableFiles(bucket, { limit: data.limit });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ file: string; message: string }> = [];

  for (const f of files) {
    const sourcePath = f.path;
    const oldPublicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(sourcePath).data.publicUrl;

    const { data: existing } = await supabaseAdmin
      .from("storage_logs")
      .select("destination_url")
      .eq("bucket", bucket)
      .eq("source_path", sourcePath)
      .eq("status", "success")
      .maybeSingle();
    if (existing?.destination_url) {
      skipped++;
      continue;
    }

    let attempts = 0;
    let newUrl: string | null = null;
    let lastErr = "";
    const key = buildR2Key({ prefix: bucket, filename: sourcePath });

    while (attempts < 3 && !newUrl) {
      attempts++;
      try {
        let bytes: Buffer;
        let contentType = "application/octet-stream";
        if (bucket === "return-images") {
          const { data: signed, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(sourcePath, 120);
          if (error || !signed) throw new Error(error?.message || "sign failed");
          const resp = await fetch(signed.signedUrl);
          if (!resp.ok) throw new Error(`download ${resp.status}`);
          contentType = resp.headers.get("content-type") || contentType;
          bytes = Buffer.from(await resp.arrayBuffer());
        } else {
          const dl = await supabaseAdmin.storage.from(bucket).download(sourcePath);
          if (dl.error) throw new Error(dl.error.message);
          const blob = dl.data as Blob;
          contentType = blob.type || contentType;
          bytes = Buffer.from(await blob.arrayBuffer());
        }
        if (bytes.byteLength === 0) throw new Error("source file is empty");

        await r2PutObject(r2, key, bytes, contentType);

        const head = await r2HeadObject(r2, key);
        if (!head) throw new Error("verification: object not found in R2 after upload");
        if (head.size !== bytes.byteLength) {
          throw new Error(`verification: size mismatch (${head.size} vs ${bytes.byteLength})`);
        }

        newUrl = r2PublicUrl(r2, key);

        for (const col of URL_COLUMNS) {
          try {
            if (col.isArray) {
              const { data: rows } = await supabaseAdmin
                .from(col.table as any)
                .select(`id, ${col.column}`)
                .contains(col.column, [oldPublicUrl]);
              for (const row of (rows ?? []) as any[]) {
                const arr = (row[col.column] as string[]) ?? [];
                const updatedArr = arr.map((u) => (u === oldPublicUrl ? newUrl! : u));
                await supabaseAdmin
                  .from(col.table as any)
                  .update({ [col.column]: updatedArr } as any)
                  .eq("id", row.id);
              }
            } else {
              await supabaseAdmin
                .from(col.table as any)
                .update({ [col.column]: newUrl } as any)
                .eq(col.column, oldPublicUrl);
            }
          } catch (e: unknown) {
            console.warn(
              `[migrate] DB update ${col.table}.${col.column}:`,
              e instanceof Error ? e.message : String(e),
            );
          }
        }

        await logEvent({
          event_type: "migration",
          bucket,
          source_path: sourcePath,
          destination_url: newUrl,
          r2_key: key,
          status: "success",
          attempts,
          size_bytes: bytes.byteLength,
          metadata: { old_url: oldPublicUrl },
        });
        migrated++;
      } catch (e: unknown) {
        lastErr = (e instanceof Error ? e.message : String(e)) || String(e);
        if (attempts < 3) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempts - 1)));
        }
      }
    }

    if (!newUrl) {
      failed++;
      errors.push({ file: sourcePath, message: lastErr });
      await logEvent({
        event_type: "migration",
        bucket,
        source_path: sourcePath,
        r2_key: key,
        status: "failed",
        attempts,
        error_message: lastErr,
        metadata: { old_url: oldPublicUrl },
      });
    }
  }

  return { bucket, scanned: files.length, migrated, skipped, failed, errors };
}

export async function retryFailedMigrationsForUser(userId: string) {
  await requireAdmin(userId);

  const { data: failed } = await supabaseAdmin
    .from("storage_logs")
    .select("id, bucket")
    .eq("status", "failed")
    .limit(200);
  const buckets = new Set<string>();
  for (const row of (failed ?? []) as any[]) if (row.bucket) buckets.add(row.bucket);

  if ((failed ?? []).length) {
    await supabaseAdmin
      .from("storage_logs")
      .update({ status: "superseded" } as any)
      .in(
        "id",
        ((failed ?? []) as any[]).map((r) => r.id),
      );
  }

  return { retried: failed?.length ?? 0, buckets: Array.from(buckets) };
}
