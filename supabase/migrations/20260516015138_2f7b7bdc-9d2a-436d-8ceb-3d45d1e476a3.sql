
-- 1. Drop over-broad "Allow public read" policies (keep the scoped is_active=true versions)
DROP POLICY IF EXISTS "Allow public read" ON public.products;
DROP POLICY IF EXISTS "Allow public read" ON public.site_content;
DROP POLICY IF EXISTS "Allow public read" ON public.coupons;

-- 2. Restrict affiliates_owner to SELECT only
DROP POLICY IF EXISTS "affiliates_owner" ON public.affiliates;
CREATE POLICY "affiliates_owner_select"
  ON public.affiliates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Remove generic auth upload on storage product-images bucket
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
