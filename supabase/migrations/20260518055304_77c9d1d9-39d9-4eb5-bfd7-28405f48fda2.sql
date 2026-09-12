
CREATE TABLE IF NOT EXISTS public.dynamic_ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL UNIQUE,
  css_classes text DEFAULT '',
  custom_js text DEFAULT '',
  json_data jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dynamic_ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active dynamic_ui_settings" ON public.dynamic_ui_settings;
CREATE POLICY "Public read active dynamic_ui_settings"
ON public.dynamic_ui_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage dynamic_ui_settings" ON public.dynamic_ui_settings;
CREATE POLICY "Admins manage dynamic_ui_settings"
ON public.dynamic_ui_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.touch_dynamic_ui_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_dynamic_ui_settings ON public.dynamic_ui_settings;
CREATE TRIGGER trg_touch_dynamic_ui_settings
BEFORE UPDATE ON public.dynamic_ui_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_dynamic_ui_settings();

-- Enable realtime
ALTER TABLE public.dynamic_ui_settings REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamic_ui_settings';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;
