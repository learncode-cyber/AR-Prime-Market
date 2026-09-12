
-- 1. Recreate views as SECURITY INVOKER
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public WITH (security_invoker=true) AS
SELECT id, title, slug, description, price, is_active, created_at,
       gallery_urls, sku, weight_kg, dimensions
FROM public.products
WHERE is_active = true;

DROP VIEW IF EXISTS public.payment_methods_public;
CREATE VIEW public.payment_methods_public WITH (security_invoker=true) AS
SELECT id, method_key, display_name, display_name_bn, icon_name, is_active,
       instructions, instructions_bn, sort_order
FROM public.payment_methods
WHERE is_active = true;

GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

-- 2. Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.dynamic_ui_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.affiliate_commissions;

-- 3. Replace blanket public storage SELECT policy with bucket-scoped one
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public read public buckets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('product-images','blog-images','category-images'));

-- 4. Explicit restrictive deny for anon on payment_methods
DROP POLICY IF EXISTS "Deny direct payment_methods read" ON public.payment_methods;
CREATE POLICY "Deny anon payment_methods" ON public.payment_methods
AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Admins read payment_methods" ON public.payment_methods
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
