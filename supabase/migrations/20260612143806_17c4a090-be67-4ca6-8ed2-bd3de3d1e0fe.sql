REVOKE SELECT (guest_token) ON public.orders FROM authenticated;
REVOKE SELECT (guest_token) ON public.orders FROM anon;