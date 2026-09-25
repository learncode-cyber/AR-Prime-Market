CREATE TABLE IF NOT EXISTS public.telegram_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_chat_history_user_time
  ON public.telegram_chat_history(user_id, created_at DESC);

GRANT ALL ON public.telegram_chat_history TO service_role;
ALTER TABLE public.telegram_chat_history ENABLE ROW LEVEL SECURITY;

-- No client access; service_role only (edge function)
CREATE POLICY "admins can read telegram history"
  ON public.telegram_chat_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
