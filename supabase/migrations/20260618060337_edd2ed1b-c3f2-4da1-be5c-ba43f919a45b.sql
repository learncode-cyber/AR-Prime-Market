REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM authenticated;
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM anon;