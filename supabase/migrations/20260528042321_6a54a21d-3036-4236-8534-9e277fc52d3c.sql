
-- 1) Column-level REVOKE on dynamic_ui_settings
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM anon, authenticated;

-- 2) Column-level REVOKE on products / product_variants
REVOKE SELECT (cogs) ON public.products FROM anon, authenticated;
REVOKE SELECT (cogs) ON public.product_variants FROM anon, authenticated;

-- 3) Column-level REVOKE on order_items
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM anon, authenticated;

-- 4) marketing_trackers: restrict SELECT to admins
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='marketing_trackers' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.marketing_trackers', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read marketing trackers"
ON public.marketing_trackers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Realtime authorization for cj_webhook_events and imported_products topics
CREATE POLICY "Admins read cj_webhook_events realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'cj_webhook_events%'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins read imported_products realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'imported_products%'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
