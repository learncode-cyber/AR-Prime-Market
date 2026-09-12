
-- 1. order_items: revoke sensitive cost columns from non-admin authenticated reads
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM authenticated;
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM anon;

-- 2. product_variants: revoke internal cost columns from anon AND authenticated
REVOKE SELECT (cogs, retail_price) ON public.product_variants FROM anon;
REVOKE SELECT (cogs, retail_price) ON public.product_variants FROM authenticated;

-- 3. marketing_trackers: restrict public read to authenticated only (drop anon)
DROP POLICY IF EXISTS "Public read active trackers" ON public.marketing_trackers;
CREATE POLICY "Authenticated read active trackers"
  ON public.marketing_trackers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 4. push_subscriptions: allow users to insert/update/delete their own subscription rows
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
