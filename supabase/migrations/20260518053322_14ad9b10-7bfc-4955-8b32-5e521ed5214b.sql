
-- 1. Fix privilege escalation on profiles: block role changes by non-admins
-- (Trigger function already exists: prevent_profile_role_change. Just attach trigger.)
DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- 2. blog_posts: add RLS policies (currently RLS enabled, no policies → nobody can read)
DROP POLICY IF EXISTS "Public can read published posts" ON public.blog_posts;
CREATE POLICY "Public can read published posts"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage all posts" ON public.blog_posts;
CREATE POLICY "Admins manage all posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Storage: explicit public read for blog-images + category-images
DROP POLICY IF EXISTS "Public read blog-images" ON storage.objects;
CREATE POLICY "Public read blog-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Public read category-images" ON storage.objects;
CREATE POLICY "Public read category-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'category-images');

-- 4. Lock down return-images: make bucket private + owner/admin-only access
UPDATE storage.buckets SET public = false WHERE id = 'return-images';

DROP POLICY IF EXISTS "Return images owner read" ON storage.objects;
CREATE POLICY "Return images owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'return-images'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Return images owner insert" ON storage.objects;
CREATE POLICY "Return images owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'return-images'
  AND owner = auth.uid()
);

-- 5. integration_settings table: stores future SEO/keyword API credentials
-- (Semrush, Ahrefs, DataForSEO, SerpAPI, etc.). Admin-managed via UI.
CREATE TABLE IF NOT EXISTS public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,           -- e.g. 'semrush','ahrefs','dataforseo','serpapi'
  api_key text,                            -- encrypted-at-rest by Supabase
  extra_config jsonb DEFAULT '{}'::jsonb,  -- region, language, etc.
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage integration_settings" ON public.integration_settings;
CREATE POLICY "Admins manage integration_settings"
ON public.integration_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
