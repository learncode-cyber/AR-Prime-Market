
-- Ad automation settings (singleton-ish: one row per platform)
CREATE TABLE IF NOT EXISTS public.ad_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE CHECK (platform IN ('meta','google')),
  enabled boolean NOT NULL DEFAULT false,
  min_roas numeric NOT NULL DEFAULT 1.5,
  max_cpa numeric NOT NULL DEFAULT 30,
  scale_roas numeric NOT NULL DEFAULT 3.0,
  scale_pct numeric NOT NULL DEFAULT 15,
  max_daily_budget numeric NOT NULL DEFAULT 200,
  monitor_window_hours integer NOT NULL DEFAULT 24,
  ad_account_id text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_automation_settings TO authenticated;
GRANT ALL ON public.ad_automation_settings TO service_role;
ALTER TABLE public.ad_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ad automation settings"
  ON public.ad_automation_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ad_automation_settings_updated
  BEFORE UPDATE ON public.ad_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Activity log for every AI ad action
CREATE TABLE IF NOT EXISTS public.ad_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  action text NOT NULL, -- launch | pause | scale | monitor | error
  external_id text,     -- platform campaign/adset id
  campaign_name text,
  reason text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_automation_logs TO authenticated;
GRANT ALL ON public.ad_automation_logs TO service_role;
ALTER TABLE public.ad_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ad logs"
  ON public.ad_automation_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ad_logs_created ON public.ad_automation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_logs_platform ON public.ad_automation_logs (platform, action);

-- Seed default rows so admin UI has something to edit
INSERT INTO public.ad_automation_settings (platform, enabled)
VALUES ('meta', false), ('google', false)
ON CONFLICT (platform) DO NOTHING;
