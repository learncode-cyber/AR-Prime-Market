-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper to notify telegram-notify function via pg_net
CREATE OR REPLACE FUNCTION public.notify_telegram_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text := 'https://vwnxnpgujxtomkxdxuvg.supabase.co/functions/v1/telegram-notify';
  v_payload jsonb;
BEGIN
  -- Fetch shared cron secret from integration_secrets (provider='cron')
  SELECT api_key INTO v_secret
  FROM public.integration_secrets
  WHERE provider = 'cron'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE LOG 'notify_telegram_event: no cron secret configured, skipping';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_telegram_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_telegram_new_order ON public.orders;
CREATE TRIGGER trg_telegram_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_telegram_event();

DROP TRIGGER IF EXISTS trg_telegram_abandoned_cart ON public.abandoned_carts;
CREATE TRIGGER trg_telegram_abandoned_cart
AFTER INSERT ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.notify_telegram_event();