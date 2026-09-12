
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'voice-agent-dispatch-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--0e6af46a-701e-425f-875c-097fc7404fde.lovable.app/api/public/voice/dispatch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bnhucGd1anh0b21reGR4dXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODMzMDUsImV4cCI6MjA4Nzc1OTMwNX0.xGv7eZudP8Gm9N1tkzSCqJydygTT-t2ZjJh_BCcJ2Lo'
    ),
    body := '{}'::jsonb
  );
  $$
);
