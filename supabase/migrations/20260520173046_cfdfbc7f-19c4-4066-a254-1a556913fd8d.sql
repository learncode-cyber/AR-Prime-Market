
CREATE TABLE public.fake_order_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  interval_seconds integer NOT NULL DEFAULT 45,
  display_seconds integer NOT NULL DEFAULT 5,
  names text[] NOT NULL DEFAULT ARRAY['Abdullah','Sadia','Tanvir','Mim','Rakib','Nusrat','Arif','Sumaiya','Imran','Farzana']::text[],
  districts text[] NOT NULL DEFAULT ARRAY['Dhaka','Chittagong','Sylhet','Bogra','Rajshahi','Khulna','Comilla','Mymensingh','Narayanganj','Cox''s Bazar']::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fake_order_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read fake order settings"
ON public.fake_order_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can insert fake order settings"
ON public.fake_order_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fake order settings"
ON public.fake_order_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete fake order settings"
ON public.fake_order_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fake_order_settings_updated_at
BEFORE UPDATE ON public.fake_order_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

INSERT INTO public.fake_order_settings (is_enabled) VALUES (true);
