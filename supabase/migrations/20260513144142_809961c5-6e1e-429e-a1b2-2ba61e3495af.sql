
DROP POLICY IF EXISTS "Guests can insert order items" ON public.order_items;
CREATE POLICY "Guests can insert order items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE guest_token IS NOT NULL AND user_id IS NULL)
  );
