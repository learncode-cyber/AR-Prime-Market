-- Competitor Ads Spy intel
CREATE TABLE public.competitor_ad_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ref text NOT NULL,
  product_title text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('meta','tiktok')),
  ad_angle text NOT NULL,
  hook_text text NOT NULL,
  hook_rate numeric(5,2) NOT NULL DEFAULT 0,
  engagement_level text NOT NULL CHECK (engagement_level IN ('low','medium','high','viral')),
  cta_url text,
  creative_thumbnail_url text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_viral boolean NOT NULL DEFAULT false,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_ad_intel TO authenticated;
GRANT ALL ON public.competitor_ad_intel TO service_role;
ALTER TABLE public.competitor_ad_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitor_ad_intel"
  ON public.competitor_ad_intel
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX competitor_ad_intel_product_ref_idx ON public.competitor_ad_intel(product_ref);
CREATE INDEX competitor_ad_intel_scanned_at_idx ON public.competitor_ad_intel(scanned_at DESC);
CREATE INDEX competitor_ad_intel_viral_idx ON public.competitor_ad_intel(is_viral) WHERE is_viral = true;

-- Viral alert log
CREATE TABLE public.viral_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ref text NOT NULL,
  intel_id uuid NOT NULL REFERENCES public.competitor_ad_intel(id) ON DELETE CASCADE,
  auto_suggested boolean NOT NULL DEFAULT false,
  pending_approval_id uuid REFERENCES public.pending_product_approvals(id) ON DELETE SET NULL,
  message text,
  notified_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_alerts TO authenticated;
GRANT ALL ON public.viral_alerts TO service_role;
ALTER TABLE public.viral_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage viral_alerts"
  ON public.viral_alerts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX viral_alerts_notified_idx ON public.viral_alerts(notified_at DESC);

-- AI-generated landing page copy
CREATE TABLE public.product_landing_copy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  headline text NOT NULL,
  subheadline text NOT NULL,
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_landing_copy TO authenticated;
GRANT ALL ON public.product_landing_copy TO service_role;
ALTER TABLE public.product_landing_copy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage product_landing_copy"
  ON public.product_landing_copy
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER product_landing_copy_touch
  BEFORE UPDATE ON public.product_landing_copy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
