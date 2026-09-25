
CREATE TABLE public.ai_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_chat_threads_user ON public.ai_chat_threads(user_id, updated_at DESC);

ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_thread_select_own" ON public.ai_chat_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_thread_insert_own" ON public.ai_chat_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_thread_update_own" ON public.ai_chat_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_thread_delete_own" ON public.ai_chat_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_chat_messages_thread ON public.ai_chat_messages(thread_id, created_at);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_msg_select_own" ON public.ai_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_msg_insert_own" ON public.ai_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_msg_delete_own" ON public.ai_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
