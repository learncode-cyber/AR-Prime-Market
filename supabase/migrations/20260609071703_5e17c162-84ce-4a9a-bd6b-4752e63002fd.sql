
-- Admin: create or replace a cron job by name
CREATE OR REPLACE FUNCTION public.admin_upsert_cron_job(
  p_jobname text,
  p_schedule text,
  p_command text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF p_jobname IS NULL OR length(trim(p_jobname)) = 0 THEN
    RAISE EXCEPTION 'jobname required';
  END IF;
  IF p_schedule IS NULL OR length(trim(p_schedule)) = 0 THEN
    RAISE EXCEPTION 'schedule required';
  END IF;
  IF p_command IS NULL OR length(trim(p_command)) = 0 THEN
    RAISE EXCEPTION 'command required';
  END IF;

  -- cron.schedule will replace existing job with same name
  SELECT cron.schedule(p_jobname, p_schedule, p_command) INTO v_id;
  RETURN v_id;
END;
$$;

-- Admin: delete (unschedule) a cron job
CREATE OR REPLACE FUNCTION public.admin_delete_cron_job(p_jobname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  RETURN cron.unschedule(p_jobname);
END;
$$;

-- Admin: pause or resume a cron job
CREATE OR REPLACE FUNCTION public.admin_set_cron_job_active(p_jobname text, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  UPDATE cron.job SET active = p_active WHERE jobname = p_jobname;
END;
$$;

-- Admin: trigger a cron job's command immediately (runs as superuser via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_trigger_cron_job(p_jobname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_cmd text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = p_jobname LIMIT 1;
  IF v_cmd IS NULL THEN
    RAISE EXCEPTION 'Job % not found', p_jobname;
  END IF;
  EXECUTE v_cmd;
  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_cron_job(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_cron_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_cron_job_active(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trigger_cron_job(text) TO authenticated;
