
DO $$ BEGIN
  CREATE TYPE public.pending_approval_status AS ENUM ('pending','approved','rejected','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pending_product_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider text NOT NULL DEFAULT 'cj',
  source_product_id text NOT NULL,
  source_url text,
  brief jsonb,
  preview jsonb NOT NULL,
  audit jsonb,
  suggested_markup_pct numeric NOT NULL DEFAULT 80,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status public.pending_approval_status NOT NULL DEFAULT 'pending',
  telegram_chat_id text,
  telegram_message_id bigint,
  approved_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  error_message text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_product_approvals TO authenticated;
GRANT ALL ON public.pending_product_approvals TO service_role;

ALTER TABLE public.pending_product_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pending approvals" ON public.pending_product_approvals;
CREATE POLICY "Admins manage pending approvals"
  ON public.pending_product_approvals
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_pending_product_approvals_updated_at ON public.pending_product_approvals;
CREATE TRIGGER update_pending_product_approvals_updated_at
  BEFORE UPDATE ON public.pending_product_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

CREATE INDEX IF NOT EXISTS idx_pending_approvals_status_created
  ON public.pending_product_approvals (status, created_at DESC);
