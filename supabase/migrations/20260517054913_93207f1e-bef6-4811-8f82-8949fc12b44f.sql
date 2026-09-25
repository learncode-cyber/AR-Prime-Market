
-- Broadcast helper for affiliate-scoped channels (topic = affiliate:<affiliate_id>)
CREATE OR REPLACE FUNCTION public.broadcast_affiliate_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id uuid;
  v_topic text;
  v_payload jsonb;
BEGIN
  IF TG_TABLE_NAME = 'affiliates' THEN
    v_affiliate_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_affiliate_id := COALESCE(NEW.affiliate_id, OLD.affiliate_id);
  END IF;

  IF v_affiliate_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_topic := 'affiliate:' || v_affiliate_id::text;
  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'record', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
  );

  PERFORM realtime.send(v_payload, TG_TABLE_NAME || '_' || lower(TG_OP), v_topic, true);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_broadcast ON public.affiliates;
CREATE TRIGGER trg_affiliates_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.broadcast_affiliate_changes();

DROP TRIGGER IF EXISTS trg_affiliate_commissions_broadcast ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_commissions
FOR EACH ROW EXECUTE FUNCTION public.broadcast_affiliate_changes();

-- Realtime channel authorization: only affiliate owner (or admin) may subscribe
-- to topic "affiliate:<affiliate_id>"
DROP POLICY IF EXISTS "Affiliate owners can read their realtime channel" ON realtime.messages;
CREATE POLICY "Affiliate owners can read their realtime channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'affiliate:%')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id::text = split_part(realtime.topic(), ':', 2)
        AND a.user_id = auth.uid()
    )
  )
);
