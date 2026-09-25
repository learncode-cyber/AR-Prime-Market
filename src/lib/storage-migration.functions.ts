import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getStorageMigrationOverviewForUser,
  migrateBucketBatchForUser,
  retryFailedMigrationsForUser,
  SUPABASE_BUCKETS,
} from "@/lib/storage-migration.server";

const BatchInput = z.object({
  bucket: z.enum(SUPABASE_BUCKETS),
  limit: z.number().int().min(1).max(500).default(50),
});

export const getStorageMigrationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getStorageMigrationOverviewForUser(context.userId);
  });

export const migrateBucketBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BatchInput.parse(input))
  .handler(async ({ data, context }) => {
    return migrateBucketBatchForUser(data, context.userId);
  });

export const retryFailedMigrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return retryFailedMigrationsForUser(context.userId);
  });
