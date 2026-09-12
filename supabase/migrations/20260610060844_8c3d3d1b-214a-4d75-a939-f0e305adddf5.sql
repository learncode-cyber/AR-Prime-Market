
CREATE TYPE public.security_event_kind AS ENUM (
  'session_integrity',
  'parameter_tampering',
  'file_magic_byte_mismatch',
  'api_token_misuse',
  'rate_anomaly',
  'rls_bypass_attempt',
  'webhook_signature_failure',
  'auth_brute_force'
);

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.security_event_kind NOT NULL,
  severity public.security_threat_level NOT NULL DEFAULT 'medium',
  source text NOT NULL,
  user_id uuid,
  ip_address text,
  user_agent text,
  endpoint text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  patch_proposal_id uuid REFERENCES public.security_patch_proposals(id) ON DELETE SET NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_kind_created ON public.security_events(kind, created_at DESC);
CREATE INDEX idx_security_events_severity_created ON public.security_events(severity, created_at DESC);
CREATE INDEX idx_security_events_unresolved ON public.security_events(created_at DESC) WHERE resolved = false;

GRANT SELECT, UPDATE ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security events"
  ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update security events"
  ON public.security_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  events_detected int NOT NULL DEFAULT 0,
  patches_queued int NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;

ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security scan runs"
  ON public.security_scan_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_kind public.security_event_kind,
  p_severity public.security_threat_level,
  p_source text,
  p_endpoint text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.security_events(kind, severity, source, endpoint, user_id, ip_address, user_agent, details)
  VALUES (p_kind, p_severity, p_source, p_endpoint, p_user_id, p_ip, p_user_agent, COALESCE(p_details,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(public.security_event_kind, public.security_threat_level, text, text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(public.security_event_kind, public.security_threat_level, text, text, uuid, text, text, jsonb) TO service_role;
