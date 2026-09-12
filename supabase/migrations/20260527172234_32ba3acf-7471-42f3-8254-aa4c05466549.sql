CREATE TABLE public.cj_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'UNKNOWN',
  cj_pid text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cj_webhook_events_received_at ON public.cj_webhook_events (received_at DESC);
CREATE INDEX idx_cj_webhook_events_type ON public.cj_webhook_events (event_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cj_webhook_events TO authenticated;
GRANT ALL ON public.cj_webhook_events TO service_role;

ALTER TABLE public.cj_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cj_webhook_events"
ON public.cj_webhook_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.cj_webhook_events;