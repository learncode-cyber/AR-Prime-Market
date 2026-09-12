
-- Long-term AI memory for autonomous learning
CREATE TABLE IF NOT EXISTS public.ai_learning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'ad_performance' | 'creative_winners' | 'support_patterns' | 'product_insights' | 'scaling'
  insight_key text NOT NULL, -- short stable key, e.g. 'meta:lookalike:product_xyz'
  insight text NOT NULL, -- human-readable learning
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb, -- raw metrics that backed the insight
  confidence numeric NOT NULL DEFAULT 0.5, -- 0..1
  impact_score numeric NOT NULL DEFAULT 0, -- estimated $ impact / weight
  source text, -- 'ad-performance-monitor' | 'daily-ceo-report' | 'ai-learning-engine' | 'support'
  applied_count integer NOT NULL DEFAULT 0,
  last_applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_learning_logs_category_idx ON public.ai_learning_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_learning_logs_key_idx ON public.ai_learning_logs(insight_key);

GRANT SELECT ON public.ai_learning_logs TO authenticated;
GRANT ALL  ON public.ai_learning_logs TO service_role;

ALTER TABLE public.ai_learning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view learning logs"
  ON public.ai_learning_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_learning_logs_updated
  BEFORE UPDATE ON public.ai_learning_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Track consecutive winning days per campaign for exponential scaling
CREATE TABLE IF NOT EXISTS public.ad_scaling_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  external_id text NOT NULL,
  campaign_name text,
  consecutive_wins integer NOT NULL DEFAULT 0,
  last_roas numeric,
  last_cpa numeric,
  last_budget numeric,
  last_scaled_at timestamptz,
  total_scales integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, external_id)
);

GRANT SELECT ON public.ad_scaling_state TO authenticated;
GRANT ALL  ON public.ad_scaling_state TO service_role;

ALTER TABLE public.ad_scaling_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view scaling state"
  ON public.ad_scaling_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ad_scaling_state_updated
  BEFORE UPDATE ON public.ad_scaling_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
