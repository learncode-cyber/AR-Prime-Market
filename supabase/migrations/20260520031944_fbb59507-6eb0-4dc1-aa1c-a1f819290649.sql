
-- Restrict sensitive cost/supplier columns from anonymous public access
REVOKE SELECT (cogs, supplier_url, source_provider, source_product_id, source_url, external_id) ON public.products FROM anon;
REVOKE SELECT (cogs) ON public.product_variants FROM anon;

-- Remove broad listing policy on avatars bucket; public URLs still work because the bucket itself is public,
-- but anonymous users can no longer enumerate/list all avatar objects via the storage API.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
