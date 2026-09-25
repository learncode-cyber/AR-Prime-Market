
-- Extend order_status with 'confirmed'
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed' BEFORE 'processing';

-- Settings (singleton)
CREATE TABLE public.voice_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  delay_seconds integer NOT NULL DEFAULT 90,
  script_template text NOT NULL DEFAULT 'আসসালামু আলাইকুম {{customer_name}}, AR Prime Market-এ অর্ডার করার জন্য ধন্যবাদ। আপনার অর্ডারটি {{total_price}} টাকা। নিশ্চিত করতে ১ চাপুন, বাতিল করতে ২ চাপুন।',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage voice_agent_settings" ON public.voice_agent_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.voice_agent_settings (enabled) VALUES (false);

-- Queue
CREATE TABLE public.voice_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|skipped|failed
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_call_queue_pending ON public.voice_call_queue (status, scheduled_at);
ALTER TABLE public.voice_call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage voice_call_queue" ON public.voice_call_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Logs
CREATE TABLE public.voice_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  phone text,
  customer_name text,
  script text NOT NULL,
  provider text NOT NULL DEFAULT 'mock',
  status text NOT NULL DEFAULT 'ringing', -- ringing|confirmed|cancelled|no_response|failed
  dtmf_digit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_call_logs_order ON public.voice_call_logs (order_id);
CREATE INDEX idx_voice_call_logs_created ON public.voice_call_logs (created_at DESC);
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage voice_call_logs" ON public.voice_call_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Trigger: queue a call on order insert
CREATE OR REPLACE FUNCTION public.queue_voice_call_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delay integer;
BEGIN
  SELECT delay_seconds INTO v_delay FROM public.voice_agent_settings LIMIT 1;
  IF v_delay IS NULL THEN v_delay := 90; END IF;
  INSERT INTO public.voice_call_queue (order_id, scheduled_at)
  VALUES (NEW.id, now() + (v_delay || ' seconds')::interval);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_queue_voice_call_after_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.queue_voice_call_for_order();

-- updated_at touches
CREATE TRIGGER trg_voice_settings_touch BEFORE UPDATE ON public.voice_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
CREATE TRIGGER trg_voice_queue_touch BEFORE UPDATE ON public.voice_call_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
CREATE TRIGGER trg_voice_logs_touch BEFORE UPDATE ON public.voice_call_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();
