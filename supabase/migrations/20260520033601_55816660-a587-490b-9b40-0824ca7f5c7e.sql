CREATE TABLE public.audit_log_export_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.audit_log_export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read own presets"
ON public.audit_log_export_presets
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert own presets"
ON public.audit_log_export_presets
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update own presets"
ON public.audit_log_export_presets
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete own presets"
ON public.audit_log_export_presets
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_audit_log_export_presets_updated
BEFORE UPDATE ON public.audit_log_export_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

CREATE INDEX idx_alep_user ON public.audit_log_export_presets (user_id, created_at DESC);