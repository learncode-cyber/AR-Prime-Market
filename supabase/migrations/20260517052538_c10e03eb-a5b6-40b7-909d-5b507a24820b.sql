
-- 1. Site content: allow public read of active sections
CREATE POLICY "Public read active site_content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 2. Coupons: allow public read of active coupons (for client-side validation)
CREATE POLICY "Public read active coupons"
  ON public.coupons FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 3. Profiles: prevent users from escalating their role
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_change();

-- 4. Return-images bucket: tighten INSERT to user's own folder
DROP POLICY IF EXISTS "Auth users can upload" ON storage.objects;

CREATE POLICY "Users upload own return-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'return-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own return-images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'return-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Public read" ON storage.objects;

-- 5. Webhooks: drop unused raw secret_token column (secrets live in webhook_secrets)
ALTER TABLE public.webhooks DROP COLUMN IF EXISTS secret_token;

-- 6. Fix function search_path
ALTER FUNCTION public.verify_api_key(text) SET search_path = public;
