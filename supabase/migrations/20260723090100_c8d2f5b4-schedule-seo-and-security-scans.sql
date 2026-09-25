-- Two routes existed with a working CRON_SECRET auth check but NO
-- scheduler ever calling them: /api/public/seo/cron (re-scans SEO —
-- sitemaps, meta tags, structured data) and
-- /api/public/cron/zero-trust-scan (security posture scan). Neither
-- appeared anywhere in supabase/migrations' cron.schedule calls before
-- this migration — they were dead code from a scheduling standpoint.
--
-- /api/public/seo/post-deploy is deliberately NOT scheduled here — its
-- name and design (accepts an optional deploy_id in the POST body) both
-- indicate it's meant to be called once per deployment by the deploy
-- pipeline (e.g. scripts/hostinger-deploy.mjs, or a CI step), not on a
-- timer. Scheduling it periodically would misrepresent what "post-deploy"
-- means. See docs/devops/CRON_SCHEDULING.md for how to wire that call in.
--
-- Both jobs below respect the same 'seo_auto_rescan' feature flag their
-- routes already check internally, so disabling that flag in the admin
-- panel pauses actual work without needing to unschedule anything.

CREATE OR REPLACE FUNCTION public.run_seo_scan_cron()
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
    RAISE LOG 'run_seo_scan_cron: no cron secret configured, skipping';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/seo/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('seo-auto-rescan-daily-5am');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Staggered from the 4am blog-generation job so they don't compete for
-- the single Hostinger Node process's resources at the same minute.
SELECT cron.schedule(
  'seo-auto-rescan-daily-5am',
  '0 5 * * *',
  $$ SELECT public.run_seo_scan_cron(); $$
);

CREATE OR REPLACE FUNCTION public.run_zero_trust_scan_cron()
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
    RAISE LOG 'run_zero_trust_scan_cron: no cron secret configured, skipping';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/cron/zero-trust-scan',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('zero-trust-scan-daily-3am');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'zero-trust-scan-daily-3am',
  '0 3 * * *',
  $$ SELECT public.run_zero_trust_scan_cron(); $$
);
