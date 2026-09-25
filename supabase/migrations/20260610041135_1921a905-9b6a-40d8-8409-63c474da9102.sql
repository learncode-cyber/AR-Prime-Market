
CREATE TABLE public.ceo_directives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'telegram',
  topic TEXT NOT NULL,
  directive TEXT NOT NULL,
  importance SMALLINT NOT NULL DEFAULT 5,
  tags TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  raw_message TEXT,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ceo_directives_active_importance ON public.ceo_directives (active, importance DESC, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceo_directives TO authenticated;
GRANT ALL ON public.ceo_directives TO service_role;
ALTER TABLE public.ceo_directives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ceo_directives" ON public.ceo_directives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ceo_directives_updated BEFORE UPDATE ON public.ceo_directives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

CREATE TABLE public.agent_research_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_query TEXT,
  model_used TEXT,
  applied_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_research_logs_recent ON public.agent_research_logs (created_at DESC);
CREATE INDEX idx_agent_research_logs_category ON public.agent_research_logs (category, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_research_logs TO authenticated;
GRANT ALL ON public.agent_research_logs TO service_role;
ALTER TABLE public.agent_research_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent_research_logs" ON public.agent_research_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_agent_research_logs_updated BEFORE UPDATE ON public.agent_research_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

CREATE OR REPLACE FUNCTION public.get_agent_memory_context(p_directive_limit INT DEFAULT 20, p_research_limit INT DEFAULT 10)
RETURNS JSONB
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'directives', COALESCE((
      SELECT jsonb_agg(row_to_json(d))
      FROM (
        SELECT topic, directive, importance, tags, created_at
        FROM public.ceo_directives
        WHERE active = true
        ORDER BY importance DESC, created_at DESC
        LIMIT p_directive_limit
      ) d
    ), '[]'::jsonb),
    'research', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT category, title, summary, key_takeaways, created_at
        FROM public.agent_research_logs
        ORDER BY created_at DESC
        LIMIT p_research_limit
      ) r
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_memory_context(INT, INT) TO authenticated, service_role;
