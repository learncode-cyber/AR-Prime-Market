-- Fixes 4 pg_cron jobs discovered pointing at a stale Lovable preview
-- domain (project--0e6af46a-....lovable.app) instead of the confirmed
-- production domain. Left as-is, these would have silently stopped
-- working the moment the app moved off that preview URL: blog
-- auto-generation, dropship stock sync, the agent scheduler tick, and
-- voice-call dispatch would all fail with no visible error anywhere.
--
-- Two of the four (generate-blog, voice/dispatch) were also sending the
-- Supabase anon/publishable key as their auth header instead of a proper
-- cron secret — upgraded here to the same dynamic
-- integration_secrets(provider='cron') lookup the other two jobs already
-- used, matching what the API Gateway's verifyCronRequest() (see
-- src/lib/gateway/cronAuth.ts) actually checks for.
--
-- See docs/devops/CRON_SCHEDULING.md for the full picture, including how
-- to rotate the cron secret if it's ever changed.

-- ---------------------------------------------------------------------
-- 1. Blog generation (was: daily 4am, anon key, stale URL)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_blog_generation_cron()
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
    RAISE LOG 'run_blog_generation_cron: no cron secret configured, skipping';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/cron/generate-blog',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('ai-seo-blog-daily-4am');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'ai-seo-blog-daily-4am',
  '0 4 * * *',
  $$ SELECT public.run_blog_generation_cron(); $$
);

-- ---------------------------------------------------------------------
-- 2. Dropship stock sync (was: hourly, stale URL only — secret handling
--    was already correct via run_stock_sync_cron(), just fixing the URL)
-- ---------------------------------------------------------------------
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
    url := 'https://arprimemarket.shop/api/public/cron/sync-stock',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
-- (job 'sync-dropship-stock-hourly' already calls this function by name,
-- so re-pointing the function body is sufficient — no reschedule needed.)

-- ---------------------------------------------------------------------
-- 3. Agent scheduler tick (was: every minute, stale URL only — secret
--    handling was already correct)
-- ---------------------------------------------------------------------
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'agent-tick-every-minute';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'agent-tick-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/cron/agent-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE(
        (SELECT api_key FROM public.integration_secrets WHERE provider = 'cron' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------
-- 4. Voice agent dispatch (was: every minute, anon key, stale URL)
-- ---------------------------------------------------------------------
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'voice-agent-dispatch-every-minute';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'voice-agent-dispatch-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://arprimemarket.shop/api/public/voice/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE(
        (SELECT api_key FROM public.integration_secrets WHERE provider = 'cron' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
