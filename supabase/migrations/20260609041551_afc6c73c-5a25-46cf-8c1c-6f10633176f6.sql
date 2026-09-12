CREATE OR REPLACE FUNCTION public.get_active_marketing_trackers()
RETURNS TABLE(provider text, tracker_id text, script_code text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider, tracker_id, script_code, is_active
  FROM public.marketing_trackers
  WHERE is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_active_marketing_trackers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_marketing_trackers() TO anon, authenticated;