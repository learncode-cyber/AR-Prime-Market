CREATE TABLE IF NOT EXISTS public.storage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  bucket text,
  source_path text,
  destination_url text,
  r2_key text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  size_bytes bigint,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storage_logs TO authenticated;
GRANT ALL ON public.storage_logs TO service_role;

ALTER TABLE public.storage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view storage logs"
  ON public.storage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_storage_logs_updated
  BEFORE UPDATE ON public.storage_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

CREATE INDEX IF NOT EXISTS idx_storage_logs_status ON public.storage_logs(status);
CREATE INDEX IF NOT EXISTS idx_storage_logs_bucket ON public.storage_logs(bucket);
CREATE INDEX IF NOT EXISTS idx_storage_logs_created ON public.storage_logs(created_at DESC);