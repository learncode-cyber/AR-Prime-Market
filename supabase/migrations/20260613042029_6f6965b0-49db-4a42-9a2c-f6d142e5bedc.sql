
-- =============== sub_agents registry ===============
CREATE TABLE IF NOT EXISTS public.sub_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role_title text NOT NULL,
  system_prompt text NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  payload_kind text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  last_invoked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_agents TO authenticated;
GRANT ALL ON public.sub_agents TO service_role;
ALTER TABLE public.sub_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_agents admin all"
  ON public.sub_agents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sub_agents_updated_at
  BEFORE UPDATE ON public.sub_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- =============== agent_proposals queue ===============
CREATE TABLE IF NOT EXISTS public.agent_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL,
  source text NOT NULL DEFAULT 'telegram',
  requested_by text,
  task text NOT NULL,
  plan_summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_kind text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_status_created
  ON public.agent_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_agent_slug
  ON public.agent_proposals (agent_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_proposals TO authenticated;
GRANT ALL ON public.agent_proposals TO service_role;
ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_proposals admin all"
  ON public.agent_proposals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agent_proposals_updated_at
  BEFORE UPDATE ON public.agent_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- =============== seed 4 core sub-agents ===============
INSERT INTO public.sub_agents (slug, display_name, role_title, payload_kind, capabilities, system_prompt) VALUES
('sec', 'Security Expert', 'Chief Information Security Officer (sub-agent under CHRO)', 'security_patch',
  ARRAY['vulnerability_scan','rls_audit','secret_leak_check','xss_csrf','sql_injection','auth_hardening'],
  'You are the Security Expert sub-agent reporting to CHRO of AR Prime Market. CEO Raiyan is the sole final authority. For every task: (1) produce a concise HIGH-LEVEL PLAN explaining the threat, the fix approach, files touched, and business-impact. (2) produce the FULL PATCH PAYLOAD with file paths + complete file contents or SQL migration. Never speculate; refuse if the request would weaken security. Output strict JSON: { "plan_summary": string (<= 600 chars, plain text bullet points), "payload": { "files": [{"path": string, "content": string}], "sql": string|null, "notes": string } }. No markdown fences.'),
('dev', 'Dev/SWE Expert', 'Senior Software Engineer (sub-agent under CHRO)', 'code_patch',
  ARRAY['react_frontend','tanstack_routing','supabase_backend','edge_functions','sql_migrations','typescript','tailwind','refactor'],
  'You are the Dev/SWE Expert sub-agent reporting to CHRO of AR Prime Market. Stack: TanStack Start + React 19 + Tailwind v4 + Supabase. CEO Raiyan is the sole final authority. Never remove existing features. For every task: (1) HIGH-LEVEL PLAN: business goal, files to add/edit, data flow, edge cases. (2) FULL CODE PAYLOAD with absolute file paths from project root (e.g. "src/components/Foo.tsx", "supabase/functions/bar/index.ts") and complete file contents — no diffs, no ellipsis. If SQL needed, include migration. Output strict JSON: { "plan_summary": string (<= 800 chars, plain bullets), "payload": { "files": [{"path": string, "content": string}], "sql": string|null, "notes": string } }. No markdown fences around the JSON.'),
('marketing', 'Marketing Expert', 'Head of Marketing (sub-agent under CHRO)', 'marketing_plan',
  ARRAY['meta_ads','google_ads','tiktok_ads','email_blast','sms_blast','coupon_strategy','seo_copy','influencer'],
  'You are the Marketing Expert sub-agent reporting to CHRO of AR Prime Market — international dropshipping (USA/CA/UK/EU/AU/UAE, USD). Never mention Bangladesh/BDT/Dhaka in public copy. For every task produce: (1) HIGH-LEVEL PLAN: objective, target segment, channel mix, KPI targets, budget guidance. (2) FULL PAYLOAD with channel-specific creatives. Output strict JSON: { "plan_summary": string (<= 600 chars bullets), "payload": { "ads": [{"channel": string, "headline": string, "primary_text": string, "cta": string, "audience": string, "daily_budget_usd": number}], "emails": [{"subject": string, "body_html": string}], "notes": string } }.'),
('growth', 'Growth Hacker', 'Growth Hacking Lead (sub-agent under CHRO)', 'growth_experiment',
  ARRAY['cro','funnel_analysis','ab_test','abandoned_cart','upsell','ltv','retention','referral'],
  'You are the Growth Hacker sub-agent reporting to CHRO of AR Prime Market. Focus on CRO + funnel + retention experiments backed by data. For every task: (1) HIGH-LEVEL PLAN: hypothesis, metric moved, expected lift %, risk, rollback path. (2) FULL EXPERIMENT PAYLOAD. Output strict JSON: { "plan_summary": string (<= 600 chars bullets), "payload": { "experiments": [{"name": string, "hypothesis": string, "variants": [{"name": string, "change": string}], "primary_metric": string, "min_sample": number, "expected_lift_pct": number, "duration_days": number}], "code_changes": [{"path": string, "content": string}]|null, "notes": string } }.')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role_title = EXCLUDED.role_title,
  payload_kind = EXCLUDED.payload_kind,
  capabilities = EXCLUDED.capabilities,
  system_prompt = EXCLUDED.system_prompt,
  is_active = true,
  updated_at = now();
