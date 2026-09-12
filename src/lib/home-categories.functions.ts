import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HomeCategoryItem = {
  id: string;
  card_id: string;
  label: string;
  image_url: string;
  search_query: string | null;
  target_slug: string | null;
  position: number;
};

export type HomeCategoryCard = {
  id: string;
  title: string;
  cta_label: string;
  target_slug: string;
  position: number;
  is_active: boolean;
  items: HomeCategoryItem[];
};

// Public reads are guarded by RLS (anon SELECT on active rows) — no service role needed.
function getPublicClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vwnxnpgujxtomkxdxuvg.supabase.co";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bnhucGd1anh0b21reGR4dXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODMzMDUsImV4cCI6MjA4Nzc1OTMwNX0.xGv7eZudP8Gm9N1tkzSCqJydygTT-t2ZjJh_BCcJ2Lo";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchCards(adminView: boolean): Promise<HomeCategoryCard[]> {
  const client: SupabaseClient = adminView ? supabaseAdmin : getPublicClient();
  let cardsQuery = client
    .from("home_category_cards")
    .select("id,title,cta_label,target_slug,position,is_active")
    .order("position", { ascending: true });
  if (!adminView) cardsQuery = cardsQuery.eq("is_active", true);

  const { data: cards, error } = await cardsQuery;
  if (error) throw new Error(error.message);
  if (!cards || cards.length === 0) return [];

  const ids = cards.map((c) => c.id);
  const { data: items, error: itemsErr } = await client
    .from("home_category_card_items")
    .select("id,card_id,label,image_url,search_query,target_slug,position")
    .in("card_id", ids)
    .order("position", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  return cards.map((c) => ({
    ...c,
    items: (items || []).filter((i) => i.card_id === c.id),
  }));
}

export const listHomeCategoryCardsPublic = createServerFn({ method: "GET" }).handler(async () =>
  fetchCards(false),
);

export const listHomeCategoryCardsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("Forbidden");
    return fetchCards(true);
  });

const cardSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  cta_label: z.string().min(1).max(60).default("See more"),
  target_slug: z.string().min(1).max(80),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const upsertHomeCategoryCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cardSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await supabaseAdmin
      .from("home_category_cards")
      .upsert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteHomeCategoryCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin.from("home_category_cards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  card_id: z.string().uuid(),
  label: z.string().min(1).max(60),
  image_url: z.string().url().max(2048),
  search_query: z.string().max(120).nullable().optional(),
  target_slug: z.string().max(80).nullable().optional(),
  position: z.number().int().min(0).default(0),
});

export const upsertHomeCategoryCardItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => itemSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await supabaseAdmin
      .from("home_category_card_items")
      .upsert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteHomeCategoryCardItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await supabaseAdmin
      .from("home_category_card_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderHomeCategoryCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabaseAdmin
        .from("home_category_cards")
        .update({ position: i })
        .eq("id", data.ids[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
