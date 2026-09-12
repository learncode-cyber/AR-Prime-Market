
-- Permanent cross-agent learning memory
CREATE TABLE IF NOT EXISTS public.agent_learning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',         -- 'global' | agent slug | 'ceo'
  category text NOT NULL,                       -- e.g. 'business_goal','product_domain','currency','tone','process'
  key text NOT NULL,                            -- stable dedupe key, e.g. 'annual_revenue_target'
  value text NOT NULL,                          -- compact semantic statement
  importance smallint NOT NULL DEFAULT 5,       -- 1..10
  source_agent text,                            -- which agent learned it
  source_ref text,                              -- e.g. telegram msg id, proposal id
  tags text[] NOT NULL DEFAULT '{}',
  is_locked boolean NOT NULL DEFAULT false,     -- locked = permanent, never auto-evict
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_learning_logs TO authenticated;
GRANT ALL ON public.agent_learning_logs TO service_role;

ALTER TABLE public.agent_learning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agent learning logs"
  ON public.agent_learning_logs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS agent_learning_logs_scope_imp_idx
  ON public.agent_learning_logs (scope, importance DESC, updated_at DESC);

CREATE TRIGGER trg_agent_learning_logs_updated_at
  BEFORE UPDATE ON public.agent_learning_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Upsert helper for edge functions (idempotent learning capture)
CREATE OR REPLACE FUNCTION public.upsert_agent_learning(
  p_scope text,
  p_category text,
  p_key text,
  p_value text,
  p_importance int DEFAULT 5,
  p_source_agent text DEFAULT NULL,
  p_source_ref text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_lock boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.agent_learning_logs(scope, category, key, value, importance, source_agent, source_ref, tags, is_locked)
  VALUES (COALESCE(NULLIF(trim(p_scope),''),'global'), p_category, p_key, p_value, GREATEST(1,LEAST(10,p_importance)), p_source_agent, p_source_ref, COALESCE(p_tags,'{}'), p_lock)
  ON CONFLICT (scope, key) DO UPDATE
    SET value = EXCLUDED.value,
        category = EXCLUDED.category,
        importance = GREATEST(public.agent_learning_logs.importance, EXCLUDED.importance),
        source_agent = COALESCE(EXCLUDED.source_agent, public.agent_learning_logs.source_agent),
        source_ref = COALESCE(EXCLUDED.source_ref, public.agent_learning_logs.source_ref),
        tags = (SELECT array_agg(DISTINCT t) FROM unnest(public.agent_learning_logs.tags || EXCLUDED.tags) t),
        is_locked = public.agent_learning_logs.is_locked OR EXCLUDED.is_locked,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Extend memory context RPC with learning logs (cross-agent sync source)
CREATE OR REPLACE FUNCTION public.get_agent_memory_context(
  p_directive_limit integer DEFAULT 20,
  p_research_limit integer DEFAULT 10,
  p_learning_limit integer DEFAULT 30,
  p_scope text DEFAULT NULL
) RETURNS jsonb
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
    ), '[]'::jsonb),
    'learning', COALESCE((
      SELECT jsonb_agg(row_to_json(l))
      FROM (
        SELECT scope, category, key, value, importance, tags, is_locked, updated_at
        FROM public.agent_learning_logs
        WHERE p_scope IS NULL OR scope IN ('global', p_scope)
        ORDER BY is_locked DESC, importance DESC, updated_at DESC
        LIMIT p_learning_limit
      ) l
    ), '[]'::jsonb)
  );
$$;

-- Seed permanent locked baselines so agent never asks again
INSERT INTO public.agent_learning_logs(scope, category, key, value, importance, source_agent, tags, is_locked)
VALUES
  ('global','business_goal','annual_revenue_target','Annual revenue target: USD $5,000,000 (multi-year compounding ladder, monthly progressive growth +20-40% early / +10-20% mature).',10,'system',ARRAY['target','revenue','$5M'],true),
  ('global','product_domain','primary_categories','Primary categories: Electronics, Gadgets, Fashion, Trending Dropshipping Items (CJ + AliExpress winners). Secondary: Beauty, Home.',10,'system',ARRAY['catalog','categories'],true),
  ('global','market','target_markets','Primary markets: USA, CA, UK, EU, AU, UAE. Pricing currency: USD.',10,'system',ARRAY['geo','currency'],true),
  ('global','supply_chain','primary_supplier','Supply chain: CJ Dropshipping primary, AliExpress secondary.',9,'system',ARRAY['supply'],true),
  ('global','persona','ceo_addressing','Sole CEO = Raiyan. Address only as "CEO" or "CEO Raiyan". Never "1st CEO" / "First CEO".',10,'system',ARRAY['persona'],true),
  ('global','response_style','lean_token_mode','Lean Token Mode: max ~200 tokens, structure "CEO, task accepted. [Action]. Status: Complete | Pending Approval | Researching.". No long intros, no motivational closings.',10,'system',ARRAY['tokens','format'],true),
  ('global','autonomy','no_counter_questions','Autonomous Execution: never ask CEO for basic market data, product list, category baseline, competitor name, price band, audience demo. Pull from research logs or assume data-backed baseline and execute.',10,'system',ARRAY['autonomy'],true)
ON CONFLICT (scope, key) DO NOTHING;
