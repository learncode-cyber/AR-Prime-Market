
-- Revoke direct SELECT on sensitive/internal columns from the anonymous role.
-- Admins and authenticated users with legitimate needs (admin panel) continue
-- to read these columns via the existing RLS policies on the `authenticated` role.

-- products: cost (cogs) and supplier sourcing details must never leak to public storefront visitors
REVOKE SELECT (cogs, supplier_url, source_url) ON public.products FROM anon;

-- product_variants: variant-level cost and internal retail_price must not leak to anon
REVOKE SELECT (cogs, retail_price) ON public.product_variants FROM anon;

-- dynamic_ui_settings: admin-managed prompt / custom_js snippets must not be readable by anonymous users
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM anon;
