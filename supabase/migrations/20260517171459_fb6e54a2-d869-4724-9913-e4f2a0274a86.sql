
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if present (allow re-run)
DO $$ BEGIN
  PERFORM cron.unschedule('ai-seo-blog-daily-4am');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'ai-seo-blog-daily-4am',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--0e6af46a-701e-425f-875c-097fc7404fde.lovable.app/api/public/cron/generate-blog',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bnhucGd1anh0b21reGR4dXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODMzMDUsImV4cCI6MjA4Nzc1OTMwNX0.xGv7eZudP8Gm9N1tkzSCqJydygTT-t2ZjJh_BCcJ2Lo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
