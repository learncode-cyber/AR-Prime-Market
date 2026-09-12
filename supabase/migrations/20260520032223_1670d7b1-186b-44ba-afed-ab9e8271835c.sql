
CREATE TABLE public.sensitive_field_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  record_ids uuid[] NOT NULL DEFAULT '{}',
  fields text[] NOT NULL DEFAULT '{}',
  context text,
  ip_address text,
  user_agent text,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sfal_user_created ON public.sensitive_field_access_logs (user_id, created_at DESC);
CREATE INDEX idx_sfal_created ON public.sensitive_field_access_logs (created_at DESC);
CREATE INDEX idx_sfal_table ON public.sensitive_field_access_logs (table_name, created_at DESC);

ALTER TABLE public.sensitive_field_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sensitive_field_access_logs"
  ON public.sensitive_field_access_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Signed-in users insert own access log"
  ON public.sensitive_field_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Deny anon sensitive_field_access_logs"
  ON public.sensitive_field_access_logs FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
