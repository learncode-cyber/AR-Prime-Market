
CREATE TABLE public.blog_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('success','failed')),
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron','manual')),
  keyword text,
  post_id uuid,
  post_title text,
  post_slug text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blog generation logs"
ON public.blog_generation_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_blog_generation_logs_created_at ON public.blog_generation_logs (created_at DESC);
