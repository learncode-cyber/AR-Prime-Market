
-- 1) Fix broad guest order items exposure
DROP POLICY IF EXISTS "Guests can read order items by token" ON public.order_items;

CREATE OR REPLACE FUNCTION public.get_guest_order(p_token text)
RETURNS TABLE (
  order_data jsonb,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_jsonb(o.*) AS order_data,
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(oi.*)) FROM public.order_items oi WHERE oi.order_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM public.orders o
  WHERE p_token IS NOT NULL
    AND o.guest_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_guest_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order(text) TO anon, authenticated;

-- 2) Profiles: add proper RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Orders: add proper RLS (was missing entirely)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Guests can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

CREATE POLICY "Users can read own orders" ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Guests can insert orders" ON public.orders
  FOR INSERT TO anon WITH CHECK (user_id IS NULL AND guest_token IS NOT NULL);
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Affiliate commissions: remove self insert/update privilege escalation
DROP POLICY IF EXISTS "commissions_affiliate_insert" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "commissions_affiliate_update" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "commissions_admin_all" ON public.affiliate_commissions;

CREATE POLICY "Admins manage commissions" ON public.affiliate_commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- existing commissions_affiliate_select stays (read-only for own commissions)

-- 5) Affiliates: replace broken JWT-role admin check with has_role
DROP POLICY IF EXISTS "affiliates_admin_all" ON public.affiliates;
CREATE POLICY "Admins manage affiliates" ON public.affiliates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage: admin-scoped write policies for image buckets
DROP POLICY IF EXISTS "Admins can manage product-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage blog-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage category-images" ON storage.objects;

CREATE POLICY "Admins can manage product-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage blog-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage category-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 7) Lock function search paths
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.generate_order_number() SET search_path = public;
ALTER FUNCTION public.broadcast_table_changes() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
