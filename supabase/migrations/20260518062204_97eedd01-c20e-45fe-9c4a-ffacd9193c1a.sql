ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_product_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS last_stock_sync timestamptz;

CREATE TABLE IF NOT EXISTS public.stock_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  provider text,
  old_stock integer,
  new_stock integer,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read stock_sync_logs" ON public.stock_sync_logs;
CREATE POLICY "Admins read stock_sync_logs" ON public.stock_sync_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));