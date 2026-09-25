
-- 1. Drop profiles.role (authorization uses user_roles table)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Drop now-obsolete trigger/function tied to old role column
DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_change();

-- 2. Split sensitive api_key into locked-down secrets table
-- First migrate any existing keys
CREATE TABLE IF NOT EXISTS public.integration_secrets (
  provider text PRIMARY KEY,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Move existing keys (if any) from integration_settings to integration_secrets
INSERT INTO public.integration_secrets (provider, api_key)
SELECT provider, api_key FROM public.integration_settings
WHERE api_key IS NOT NULL AND api_key <> ''
ON CONFLICT (provider) DO NOTHING;

-- Drop api_key column from public-facing table
ALTER TABLE public.integration_settings DROP COLUMN IF EXISTS api_key;

-- Lock down integration_secrets: NO client access at all
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny all client access to integration_secrets" ON public.integration_secrets;
CREATE POLICY "deny all client access to integration_secrets"
ON public.integration_secrets
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Revoke direct PostgREST grants (defence in depth)
REVOKE ALL ON public.integration_secrets FROM anon, authenticated;

-- 3. Admin-only RPC to set/rotate integration secrets
CREATE OR REPLACE FUNCTION public.set_integration_secret(
  p_provider text,
  p_api_key text,
  p_extra_config jsonb DEFAULT '{}'::jsonb,
  p_activate boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  IF p_provider IS NULL OR length(trim(p_provider)) = 0 THEN
    RAISE EXCEPTION 'provider required';
  END IF;
  IF p_api_key IS NULL OR length(trim(p_api_key)) = 0 THEN
    RAISE EXCEPTION 'api_key required';
  END IF;

  -- Upsert secret
  INSERT INTO public.integration_secrets (provider, api_key, updated_at)
  VALUES (lower(trim(p_provider)), p_api_key, now())
  ON CONFLICT (provider) DO UPDATE
    SET api_key = excluded.api_key, updated_at = now();

  -- Upsert public settings (no key here)
  INSERT INTO public.integration_settings (provider, extra_config, is_active, updated_at)
  VALUES (lower(trim(p_provider)), COALESCE(p_extra_config, '{}'::jsonb), p_activate, now())
  ON CONFLICT (provider) DO UPDATE
    SET extra_config = excluded.extra_config,
        is_active = excluded.is_active,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_integration_secret(text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_integration_secret(text, text, jsonb, boolean) TO authenticated;

-- 4. Admin-only RPC to delete a secret
CREATE OR REPLACE FUNCTION public.delete_integration_secret(p_provider text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  DELETE FROM public.integration_secrets WHERE provider = lower(trim(p_provider));
  UPDATE public.integration_settings SET is_active = false WHERE provider = lower(trim(p_provider));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_integration_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_integration_secret(text) TO authenticated;
