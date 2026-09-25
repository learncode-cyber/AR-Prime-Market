
CREATE TABLE IF NOT EXISTS public.autonomous_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  source text,
  ref_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  status text NOT NULL DEFAULT 'pending',
  importance int NOT NULL DEFAULT 5,
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autonomous_staging TO authenticated;
GRANT ALL ON public.autonomous_staging TO service_role;

ALTER TABLE public.autonomous_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read autonomous_staging" ON public.autonomous_staging;
CREATE POLICY "admin read autonomous_staging"
ON public.autonomous_staging FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin write autonomous_staging" ON public.autonomous_staging;
CREATE POLICY "admin write autonomous_staging"
ON public.autonomous_staging FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS autonomous_staging_kind_status_idx
  ON public.autonomous_staging (kind, status, importance DESC, created_at DESC);

CREATE TRIGGER autonomous_staging_touch
BEFORE UPDATE ON public.autonomous_staging
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Telegram file attachment staging table (raw bytes ingested via webhook)
CREATE TABLE IF NOT EXISTS public.telegram_file_ingest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  chat_id text NOT NULL,
  target_agent text,
  task text,
  file_id text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  text_preview text,
  status text NOT NULL DEFAULT 'staged',
  proposal_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_file_ingest TO authenticated;
GRANT ALL ON public.telegram_file_ingest TO service_role;

ALTER TABLE public.telegram_file_ingest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all telegram_file_ingest" ON public.telegram_file_ingest;
CREATE POLICY "admin all telegram_file_ingest"
ON public.telegram_file_ingest FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER telegram_file_ingest_touch
BEFORE UPDATE ON public.telegram_file_ingest
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Structural-response cache (for /agents, /agents_health style commands)
CREATE TABLE IF NOT EXISTS public.response_cache (
  cache_key text PRIMARY KEY,
  state_hash text NOT NULL,
  payload jsonb NOT NULL,
  rendered text,
  hit_count int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.response_cache TO authenticated;
GRANT ALL ON public.response_cache TO service_role;

ALTER TABLE public.response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read response_cache" ON public.response_cache;
CREATE POLICY "admin read response_cache"
ON public.response_cache FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
