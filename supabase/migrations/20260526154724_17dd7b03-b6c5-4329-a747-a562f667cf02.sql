
-- 1. Revoke sensitive columns from anon
REVOKE SELECT (cogs, supplier_url, source_url) ON public.products FROM anon;
REVOKE SELECT (cogs, retail_price) ON public.product_variants FROM anon;
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM anon;

-- 2. Also revoke from authenticated for these admin-only columns to avoid leakage to logged-in users
REVOKE SELECT (cogs, supplier_url, source_url) ON public.products FROM authenticated;
REVOKE SELECT (cogs, retail_price) ON public.product_variants FROM authenticated;
REVOKE SELECT (prompt, custom_js) ON public.dynamic_ui_settings FROM authenticated;

-- 3. Add explicit restrictive SELECT policies on email_logs (admin-only)
DROP POLICY IF EXISTS "Only admins can read email_logs" ON public.email_logs;
CREATE POLICY "Only admins can read email_logs"
ON public.email_logs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Add explicit restrictive SELECT policy on voice_call_logs (admin-only)
DROP POLICY IF EXISTS "Only admins can read voice_call_logs" ON public.voice_call_logs;
CREATE POLICY "Only admins can read voice_call_logs"
ON public.voice_call_logs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
