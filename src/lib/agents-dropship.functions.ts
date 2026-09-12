// Multi-Agent AI Control Center — server function wrappers.
// Real logic lives in agents-dropship.server.ts so it can be reused by the
// autonomous sourcing pipeline without a self-RPC roundtrip.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  trendHunter,
  sourcingAuditor,
  type WinningProductBrief,
  type SourcingAudit,
} from "@/lib/agents-dropship.server";

export type { WinningProductBrief, SourcingAudit };

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const runTrendHunter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        niche: z.string().max(120).optional(),
        count: z.number().int().min(1).max(8).default(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return trendHunter(data);
  });

const previewShape = z.object({
  provider: z.enum(["cj", "aliexpress", "spocket", "url"]),
  source_product_id: z.string(),
  source_url: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  compare_at_price: z.number().nullable(),
  stock_quantity: z.number(),
  images: z.array(z.string()),
  sku: z.string().nullable(),
  currency: z.string(),
});

export const runSourcingAuditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ preview: previewShape }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return sourcingAuditor(data.preview);
  });
