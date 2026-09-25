
-- Marketing trackers table
CREATE TABLE IF NOT EXISTS public.marketing_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  tracker_id text,
  script_code text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active trackers"
  ON public.marketing_trackers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage trackers"
  ON public.marketing_trackers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Blog posts: SEO keywords + author name
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'AR Prime Market';
