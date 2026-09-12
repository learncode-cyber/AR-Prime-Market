-- Re-apply column-level REVOKEs on dynamic_ui_settings sensitive columns
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM anon;
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM authenticated;

-- Revoke COGS / supplier identifiers on order_items from customers
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM anon;
REVOKE SELECT (cogs, supplier_product_id, supplier_variant_id) ON public.order_items FROM authenticated;