
-- SEO scan runs
CREATE TABLE public.seo_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','deploy','cron')),
  score integer,
  pass_count integer NOT NULL DEFAULT 0,
  warn_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  deploy_id text,
  notes text
);

CREATE INDEX idx_seo_scan_runs_started_at ON public.seo_scan_runs (started_at DESC);
ALTER TABLE public.seo_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seo_scan_runs" ON public.seo_scan_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- SEO scan findings
CREATE TABLE public.seo_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.seo_scan_runs(id) ON DELETE CASCADE,
  url text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('pass','warn','fail')),
  check_id text NOT NULL,
  message text NOT NULL,
  fix_hint text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_scan_findings_run_id ON public.seo_scan_findings (run_id);
ALTER TABLE public.seo_scan_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seo_scan_findings" ON public.seo_scan_findings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- SEO scan config (singleton)
CREATE TABLE public.seo_scan_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  auto_rescan_enabled boolean NOT NULL DEFAULT true,
  schedule_cron text NOT NULL DEFAULT '0 */6 * * *',
  target_urls jsonb NOT NULL DEFAULT '["/","/faq","/categories/electronics"]'::jsonb,
  pagespeed_enabled boolean NOT NULL DEFAULT false,
  base_url text NOT NULL DEFAULT 'https://arprimemarket.shop',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_scan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seo_scan_config" ON public.seo_scan_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.seo_scan_config (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

-- Feature flag
INSERT INTO public.feature_flags (key, label, description, category, is_enabled)
VALUES ('seo_auto_rescan', 'SEO Auto-Rescan', 'Automatically re-run SEO audit after each deploy and on schedule', 'seo', true)
ON CONFLICT (key) DO NOTHING;
