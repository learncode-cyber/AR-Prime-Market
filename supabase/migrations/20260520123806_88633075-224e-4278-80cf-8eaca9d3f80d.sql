
CREATE TABLE public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  admin_note TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  source TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, account_id)
);

CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  platform_campaign_id TEXT,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  roas NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  cpa NUMERIC NOT NULL DEFAULT 0,
  target_audience JSONB,
  product_ids UUID[],
  ai_created BOOLEAN NOT NULL DEFAULT false,
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ad_performance_snapshots (
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  roas NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, snapshot_date)
);

CREATE TABLE public.researched_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  external_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  supplier_price NUMERIC,
  suggested_price NUMERIC,
  profit_margin NUMERIC,
  images TEXT[],
  category TEXT,
  ai_score INTEGER NOT NULL DEFAULT 0,
  ai_reasoning TEXT,
  trend_data JSONB,
  competition_analysis JSONB,
  status TEXT NOT NULL DEFAULT 'researched',
  imported_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  target_segment JSONB,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  clicked INTEGER NOT NULL DEFAULT 0,
  converted INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC NOT NULL DEFAULT 0,
  ai_created BOOLEAN NOT NULL DEFAULT false,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researched_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON public.agent_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.agent_memory FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.agent_decisions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.agent_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.ad_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.ad_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.ad_performance_snapshots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.researched_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.marketing_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_all" ON public.agent_notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX idx_agent_tasks_status ON public.agent_tasks (status, priority, created_at DESC);
CREATE INDEX idx_agent_notifications_unread ON public.agent_notifications (is_read, created_at DESC);
CREATE INDEX idx_ad_campaigns_status_roas ON public.ad_campaigns (status, roas);
CREATE INDEX idx_researched_products_status_score ON public.researched_products (status, ai_score DESC);
CREATE INDEX idx_ad_snapshots_campaign_date ON public.ad_performance_snapshots (campaign_id, snapshot_date DESC);
CREATE INDEX idx_agent_decisions_task ON public.agent_decisions (task_id, created_at DESC);

CREATE TRIGGER trg_agent_tasks_updated BEFORE UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
CREATE TRIGGER trg_ad_campaigns_updated BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
CREATE TRIGGER trg_agent_config_updated BEFORE UPDATE ON public.agent_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_decisions;

INSERT INTO public.agent_config (key, value, description) VALUES
  ('auto_approve_threshold', '"low"'::jsonb, 'Tasks at or below this priority auto-approve'),
  ('daily_ad_budget_limit', '5000'::jsonb, 'Max daily ad budget agent can allocate'),
  ('product_import_limit', '10'::jsonb, 'Max products agent can queue per day'),
  ('roas_pause_threshold', '0.8'::jsonb, 'Pause ad if ROAS falls below this'),
  ('roas_scale_threshold', '3.0'::jsonb, 'Scale ad budget if ROAS exceeds this'),
  ('agent_enabled', 'true'::jsonb, 'Master on/off switch'),
  ('working_hours', '{"start":8,"end":23}'::jsonb, 'Agent active hours'),
  ('notification_channels', '["email","push"]'::jsonb, 'How to notify admin');
