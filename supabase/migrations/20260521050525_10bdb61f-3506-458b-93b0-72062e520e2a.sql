CREATE TABLE public.fake_order_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('impression','dismiss')),
  name text,
  district text,
  product_id uuid,
  product_title text,
  path text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_fake_order_events_created_at ON public.fake_order_events (created_at DESC);
CREATE INDEX idx_fake_order_events_type ON public.fake_order_events (event_type);
CREATE INDEX idx_fake_order_events_product ON public.fake_order_events (product_id);

ALTER TABLE public.fake_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert fake order events"
ON public.fake_order_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read fake order events"
ON public.fake_order_events FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete fake order events"
ON public.fake_order_events FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));