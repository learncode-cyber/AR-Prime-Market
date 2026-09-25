-- 1. cj_tokens table
CREATE TABLE public.cj_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cj_tokens TO authenticated;
GRANT ALL ON public.cj_tokens TO service_role;

ALTER TABLE public.cj_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cj_tokens"
ON public.cj_tokens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cj_tokens_updated_at
BEFORE UPDATE ON public.cj_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- 2. imported_products table
CREATE TABLE public.imported_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cj_pid text NOT NULL UNIQUE,
  product_name text NOT NULL,
  product_name_en text,
  product_image text,
  product_description text,
  sell_price numeric(12,2),
  product_status integer NOT NULL DEFAULT 3,
  category_id text,
  category_name text,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_imported_products_status ON public.imported_products(product_status);
CREATE INDEX idx_imported_products_cj_pid ON public.imported_products(cj_pid);

GRANT SELECT ON public.imported_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_products TO authenticated;
GRANT ALL ON public.imported_products TO service_role;

ALTER TABLE public.imported_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view on-sale imported products"
ON public.imported_products
FOR SELECT
TO anon, authenticated
USING (product_status = 3);

CREATE POLICY "Admins manage imported_products"
ON public.imported_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER TABLE public.imported_products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imported_products;

-- 3. Vault helpers for CJ_API_KEY
CREATE OR REPLACE FUNCTION public.get_cj_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'CJ_API_KEY'
  LIMIT 1;
  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cj_api_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cj_api_key() TO service_role;

CREATE OR REPLACE FUNCTION public.set_cj_api_key(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'CJ_API_KEY cannot be empty';
  END IF;

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'CJ_API_KEY' LIMIT 1;

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(p_key, 'CJ_API_KEY', 'CJ Dropshipping API key');
  ELSE
    PERFORM vault.update_secret(v_existing_id, p_key, 'CJ_API_KEY', 'CJ Dropshipping API key');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_cj_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_cj_api_key(text) TO service_role;