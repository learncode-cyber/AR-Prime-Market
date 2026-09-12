
-- 1) ai_learning_logs -> agent_learning_logs
INSERT INTO public.agent_learning_logs (scope, category, key, value, importance, source_agent, source_ref, tags, is_locked, created_at, updated_at)
SELECT
  'learning_engine',
  COALESCE(category, 'general'),
  'learning:' || COALESCE(category,'general') || ':' || insight_key,
  insight,
  GREATEST(1, LEAST(10, COALESCE(ROUND(confidence * 10)::int, 6))),
  'ai-learning-engine',
  jsonb_build_object(
    'legacy_id', id, 'confidence', confidence, 'impact_score', impact_score,
    'applied_count', applied_count, 'evidence', evidence, 'last_applied_at', last_applied_at
  )::text,
  ARRAY['learning', COALESCE(category,'general')],
  false,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM public.ai_learning_logs
ON CONFLICT (scope, key) DO UPDATE
  SET value = EXCLUDED.value,
      category = EXCLUDED.category,
      importance = GREATEST(public.agent_learning_logs.importance, EXCLUDED.importance),
      source_ref = EXCLUDED.source_ref,
      updated_at = EXCLUDED.updated_at;

DROP TABLE IF EXISTS public.ai_learning_logs CASCADE;

-- 2) security_patch_proposals -> agent_proposals (preserve ids)
INSERT INTO public.agent_proposals (
  id, agent_slug, source, requested_by, task, plan_summary, payload, payload_kind,
  status, decision_note, decided_at, applied_at, created_at, updated_at
)
SELECT
  spp.id,
  'sec',
  COALESCE(spp.proposed_by, 'zero_trust_monitor'),
  COALESCE(spp.proposed_by, 'zero_trust_monitor'),
  (spp.vulnerability_type || ' on ' || spp.module),
  COALESCE(spp.patch_code, spp.root_cause),
  jsonb_build_object(
    'module', spp.module,
    'file_path', spp.file_path,
    'vulnerability_type', spp.vulnerability_type,
    'threat_level', spp.threat_level,
    'root_cause', spp.root_cause,
    'impact', spp.impact,
    'patch_language', spp.patch_language,
    'patch_code', spp.patch_code,
    'approval_channel', spp.approval_channel,
    'approved_by_user_id', spp.approved_by_user_id
  ),
  'security_patch',
  spp.status::text,
  spp.decision_note,
  spp.decided_at,
  spp.applied_at,
  spp.created_at,
  COALESCE(spp.updated_at, spp.created_at, now())
FROM public.security_patch_proposals spp
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.security_events
  DROP CONSTRAINT IF EXISTS security_events_patch_proposal_id_fkey;

DROP TABLE IF EXISTS public.security_patch_proposals CASCADE;
