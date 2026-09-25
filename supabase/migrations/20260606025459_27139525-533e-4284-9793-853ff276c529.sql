
-- 1. Restrict sensitive columns on dynamic_ui_settings
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_dynamic_ui_settings_admin()
RETURNS SETOF public.dynamic_ui_settings
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  RETURN QUERY SELECT * FROM public.dynamic_ui_settings ORDER BY updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dynamic_ui_settings_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dynamic_ui_settings_admin() TO authenticated;

-- 2. Restrict tracking_pixels to admin-only (unused in client code; pixel IDs are loaded server-side)
DROP POLICY IF EXISTS "Tracking pixels are publicly readable" ON public.tracking_pixels;
DROP POLICY IF EXISTS "tracking_pixels_public_read" ON public.tracking_pixels;
DROP POLICY IF EXISTS "Public read tracking_pixels" ON public.tracking_pixels;
DROP POLICY IF EXISTS "Anyone can read tracking_pixels" ON public.tracking_pixels;

CREATE POLICY "Admins read tracking_pixels"
ON public.tracking_pixels FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Restrict orders.guest_token column from owners; only service_role needs it
REVOKE SELECT (guest_token) ON public.orders FROM anon, authenticated;
