-- Unschedule if exists (idempotent)
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
    url := 'https://project--0e6af46a-701e-425f-875c-097fc7404fde.lovable.app/api/public/cron/agent-tick',
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