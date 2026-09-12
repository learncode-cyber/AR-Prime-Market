CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_stock_sync_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT api_key INTO v_secret FROM public.integration_secrets WHERE provider = 'cron' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE LOG 'run_stock_sync_cron: no cron secret configured, skipping';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := 'https://project--0e6af46a-701e-425f-875c-097fc7404fde.lovable.app/api/public/cron/sync-stock',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

-- Unschedule existing job (if any) then re-schedule hourly.
DO $$
BEGIN
  PERFORM cron.unschedule('sync-dropship-stock-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-dropship-stock-hourly',
  '0 * * * *',
  $$ SELECT public.run_stock_sync_cron(); $$
);