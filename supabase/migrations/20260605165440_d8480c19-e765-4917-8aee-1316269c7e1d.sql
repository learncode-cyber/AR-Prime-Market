CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT jsonb_agg(row_to_json(j))
  INTO v_result
  FROM (
    SELECT
      j.jobid,
      j.jobname,
      j.schedule,
      j.active,
      j.command,
      (
        SELECT row_to_json(r)
        FROM (
          SELECT
            d.runid,
            d.status,
            d.return_message,
            d.start_time,
            d.end_time
          FROM cron.job_run_details d
          WHERE d.jobid = j.jobid
          ORDER BY d.start_time DESC
          LIMIT 1
        ) r
      ) AS last_run,
      (
        SELECT jsonb_agg(row_to_json(h) ORDER BY h.start_time DESC)
        FROM (
          SELECT d.runid, d.status, d.start_time, d.end_time, d.return_message
          FROM cron.job_run_details d
          WHERE d.jobid = j.jobid
          ORDER BY d.start_time DESC
          LIMIT 10
        ) h
      ) AS history,
      (
        SELECT jsonb_build_object(
          'success', COUNT(*) FILTER (WHERE d.status = 'succeeded'),
          'failed', COUNT(*) FILTER (WHERE d.status = 'failed'),
          'total', COUNT(*)
        )
        FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
          AND d.start_time > now() - interval '24 hours'
      ) AS stats_24h
    FROM cron.job j
    ORDER BY j.jobname
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_status() TO authenticated;