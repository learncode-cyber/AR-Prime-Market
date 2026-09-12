-- Schedules the fx-rates sync route added alongside the create_order
-- currency fix (migration 20260729080000_d4e8f1a7_*.sql). Runs hourly —
-- exchange rates don't need to be fresher than that for a reference table
-- whose main job is being a safe, fast, non-external-dependency source
-- for the create_order() function during checkout.

CREATE OR REPLACE FUNCTION public.run_fx_rates_sync_cron()
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
    RAISE LOG 'run_fx_rates_sync_cron: no cron secret configured, skipping';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/cron/sync-fx-rates',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('fx-rates-sync-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fx-rates-sync-hourly',
  '0 * * * *',
  $$ SELECT public.run_fx_rates_sync_cron(); $$
);
