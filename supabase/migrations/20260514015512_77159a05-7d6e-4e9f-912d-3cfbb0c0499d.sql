
-- Drop direct insert policies — orders must go through create_order RPC
DROP POLICY IF EXISTS "Guests can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Guests can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;

CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_shipping jsonb,
  p_email text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_payment_method text DEFAULT 'cod'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_guest_token text := NULL;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_unit_price numeric;
  v_qty int;
  v_title text;
  v_image text;
  v_coupon record;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF v_user IS NULL THEN
    v_guest_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  -- Validate items + compute subtotal server-side
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    SELECT id, title, price, is_active, stock_quantity, gallery_urls
      INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product unavailable: %', v_item->>'product_id';
    END IF;

    IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.title;
    END IF;

    v_unit_price := v_product.price;
    v_title := v_product.title;
    v_image := COALESCE((v_item->>'image_url'), (v_product.gallery_urls)[1]);

    IF (v_item->>'variant_id') IS NOT NULL AND length(v_item->>'variant_id') > 0 THEN
      SELECT id, name, value, additional_price, stock_quantity
        INTO v_variant
        FROM public.product_variants
       WHERE id = (v_item->>'variant_id')::uuid
         AND product_id = v_product.id;

      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION 'Invalid variant';
      END IF;

      v_unit_price := v_unit_price + COALESCE(v_variant.additional_price, 0);
      v_title := v_title || ' (' || v_variant.value || ')';
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    -- Stash computed fields back for second pass
    v_item := v_item || jsonb_build_object(
      '_unit_price', v_unit_price,
      '_title', v_title,
      '_image', v_image,
      '_qty', v_qty
    );
    -- Replace element (rebuild not needed; we'll re-scan items below using same logic)
  END LOOP;

  -- Coupon validation server-side
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon
      FROM public.coupons
     WHERE code = upper(trim(p_coupon_code))
       AND is_active = true
     LIMIT 1;

    IF v_coupon.id IS NULL THEN
      RAISE EXCEPTION 'Invalid coupon';
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
      RAISE EXCEPTION 'Coupon expired';
    END IF;
    IF v_coupon.min_order_amount IS NOT NULL AND v_subtotal < v_coupon.min_order_amount THEN
      RAISE EXCEPTION 'Order below coupon minimum';
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := v_subtotal * COALESCE(v_coupon.discount_value, 0) / 100;
    ELSE
      v_discount := COALESCE(v_coupon.discount_value, 0);
    END IF;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount);

  -- Insert order
  INSERT INTO public.orders (
    user_id, guest_token, guest_email, total_amount,
    shipping_address, payment_method, status, currency
  ) VALUES (
    v_user, v_guest_token, p_email, v_total,
    p_shipping::text, COALESCE(p_payment_method, 'cod'), 'pending'::order_status, 'BDT'
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert items (re-resolve to be safe)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    SELECT id, title, price, gallery_urls INTO v_product
      FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    v_unit_price := v_product.price;
    v_title := v_product.title;
    v_image := COALESCE((v_item->>'image_url'), (v_product.gallery_urls)[1]);

    IF (v_item->>'variant_id') IS NOT NULL AND length(v_item->>'variant_id') > 0 THEN
      SELECT id, value, additional_price INTO v_variant
        FROM public.product_variants
       WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;
      v_unit_price := v_unit_price + COALESCE(v_variant.additional_price, 0);
      v_title := v_title || ' (' || v_variant.value || ')';
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, title, quantity, unit_price, image_url, variant_label
    ) VALUES (
      v_order_id,
      v_product.id,
      NULLIF(v_item->>'variant_id','')::uuid,
      v_title,
      v_qty,
      v_unit_price,
      v_image,
      v_variant.value
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'guest_token', v_guest_token,
    'total', v_total,
    'subtotal', v_subtotal,
    'discount', v_discount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb, text, text, text) TO anon, authenticated;
