CREATE OR REPLACE FUNCTION public.broadcast_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
BEGIN
  PERFORM realtime.send(
    to_jsonb(NEW),
    TG_OP,
    TG_TABLE_NAME::text,
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating write if realtime broadcast fails
  RETURN NEW;
END;
$$;