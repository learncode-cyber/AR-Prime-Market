
-- 1. dynamic_ui_settings: drop the public SELECT policy; expose only safe columns via a SECURITY DEFINER function
DROP POLICY IF EXISTS "Public read active dynamic_ui_settings" ON public.dynamic_ui_settings;

CREATE OR REPLACE FUNCTION public.get_active_dynamic_ui_settings()
RETURNS TABLE (
  component_name text,
  css_classes text,
  json_data jsonb,
  is_active boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT component_name, css_classes, json_data, is_active, updated_at
  FROM public.dynamic_ui_settings
  WHERE is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_active_dynamic_ui_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_dynamic_ui_settings() TO anon, authenticated;

-- 2. tracking_pixels: drop the public read policy (admin-only policy already exists)
DROP POLICY IF EXISTS "Allow public read" ON public.tracking_pixels;
