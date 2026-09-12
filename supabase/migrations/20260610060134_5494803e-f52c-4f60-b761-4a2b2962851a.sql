
CREATE TYPE public.security_patch_status AS ENUM ('pending','approved','rejected','applied');
CREATE TYPE public.security_threat_level AS ENUM ('low','medium','high','critical');

CREATE TABLE public.security_patch_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  file_path text,
  vulnerability_type text NOT NULL,
  threat_level public.security_threat_level NOT NULL DEFAULT 'medium',
  root_cause text NOT NULL,
  impact text NOT NULL,
  patch_language text NOT NULL DEFAULT 'typescript',
  patch_code text NOT NULL,
  status public.security_patch_status NOT NULL DEFAULT 'pending',
  proposed_by text NOT NULL DEFAULT 'cyber_security_subagent',
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_channel text,
  telegram_message_id bigint,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_patch_proposals_status ON public.security_patch_proposals(status, created_at DESC);
CREATE INDEX idx_security_patch_proposals_threat ON public.security_patch_proposals(threat_level, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.security_patch_proposals TO authenticated;
GRANT ALL ON public.security_patch_proposals TO service_role;

ALTER TABLE public.security_patch_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security patch proposals"
  ON public.security_patch_proposals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create security patch proposals"
  ON public.security_patch_proposals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update security patch proposals"
  ON public.security_patch_proposals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_security_patch_proposals_updated
  BEFORE UPDATE ON public.security_patch_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
