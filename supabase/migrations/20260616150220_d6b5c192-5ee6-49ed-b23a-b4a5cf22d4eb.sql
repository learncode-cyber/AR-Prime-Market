-- Restrict anon role from reading sensitive cost/supplier columns on products
REVOKE SELECT (cogs, supplier_url, source_url, source_product_id, source_provider)
  ON public.products FROM anon;

-- Restrict anon role from reading variant-level cost-of-goods
REVOKE SELECT (cogs) ON public.product_variants FROM anon;