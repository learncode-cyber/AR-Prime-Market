-- 1) Hide cogs on order_items from authenticated (and anon)
REVOKE SELECT (cogs) ON public.order_items FROM authenticated;
REVOKE SELECT (cogs) ON public.order_items FROM anon;
GRANT SELECT (cogs) ON public.order_items TO service_role;

-- 2) Hide custom_js on dynamic_ui_settings from anon + authenticated
REVOKE SELECT (custom_js) ON public.dynamic_ui_settings FROM anon;
REVOKE SELECT (custom_js) ON public.dynamic_ui_settings FROM authenticated;
GRANT SELECT (custom_js) ON public.dynamic_ui_settings TO service_role;

-- 3) Allow users to read their own push_subscriptions
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
