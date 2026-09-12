SELECT net.http_post(
  url := 'https://vwnxnpgujxtomkxdxuvg.supabase.co/functions/v1/telegram-webhook?setup=1',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'x-cron-secret', (SELECT api_key FROM public.integration_secrets WHERE provider='cron' LIMIT 1)
  ),
  body := '{}'::jsonb
);