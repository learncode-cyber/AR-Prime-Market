CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_shipping jsonb,
  p_email text DEFAULT NULL::text,
  p_coupon_code text DEFAULT NULL::text,
  p_payment_method text DEFAULT 'cod'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_payment_method text;
  v_estimated_delivery timestamptz;
  v_ship_name text;
  v_ship_phone text;
  v_ship_line1 text;
  v_ship_line2 text;
  v_ship_city text;
  v_ship_state text;
  v_ship_postal text;
  v_ship_country text;
  v_ship_country_name text;
  v_ship_notes text;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF v_user IS NULL THEN
    v_guest_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  v_payment_method := lower(coalesce(nullif(trim(p_payment_method), ''), 'cod'));
  IF v_payment_method NOT IN ('cod','bkash','nagad','rocket','binance','bank_transfer','card') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', v_payment_method;
  END IF;

  v_estimated_delivery := now() + INTERVAL '5 days';

  -- Extract structured shipping fields (accept multiple aliases for compatibility)
  v_ship_name         := COALESCE(p_shipping->>'name', p_shipping->>'full_name', p_shipping->>'customer_name');
  v_ship_phone        := COALESCE(p_shipping->>'phone', p_shipping->>'customer_phone');
  v_ship_line1        := COALESCE(p_shipping->>'line1', p_shipping->>'address', p_shipping->>'address_line1');
  v_ship_line2        := COALESCE(p_shipping->>'line2', p_shipping->>'address_line2');
  v_ship_city         := p_shipping->>'city';
  v_ship_state        := COALESCE(p_shipping->>'state', p_shipping->>'region');
  v_ship_postal       := COALESCE(p_shipping->>'postal_code', p_shipping->>'postal', p_shipping->>'zip');
  v_ship_country      := COALESCE(p_shipping->>'country', p_shipping->>'country_code');
  v_ship_country_name := COALESCE(p_shipping->>'country_name', p_shipping->>'countryName');
  v_ship_notes        := COALESCE(p_shipping->>'notes', p_shipping->>'customer_note');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    SELECT id, title, price, is_active, stock_quantity, gallery_urls
      INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid
     FOR UPDATE;

    IF v_product.id IS NULL OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product unavailable: %', v_item->>'product_id';
    END IF;

    IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.title;
    END IF;

    v_unit_price := v_product.price;

    IF (v_item->>'variant_id') IS NOT NULL AND length(v_item->>'variant_id') > 0 THEN
      SELECT id, name, value, additional_price, stock_quantity
        INTO v_variant
        FROM public.product_variants
       WHERE id = (v_item->>'variant_id')::uuid
         AND product_id = v_product.id
       FOR UPDATE;

      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION 'Invalid variant';
      END IF;

      IF v_variant.stock_quantity IS NOT NULL AND v_variant.stock_quantity < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for variant %', v_variant.value;
      END IF;

      v_unit_price := v_unit_price + COALESCE(v_variant.additional_price, 0);
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.coupons
     WHERE code = upper(trim(p_coupon_code)) AND is_active = true LIMIT 1;
    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN RAISE EXCEPTION 'Coupon expired'; END IF;
    IF v_coupon.min_order_amount IS NOT NULL AND v_subtotal < v_coupon.min_order_amount THEN RAISE EXCEPTION 'Order below coupon minimum'; END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := v_subtotal * COALESCE(v_coupon.discount_value, 0) / 100;
    ELSE
      v_discount := COALESCE(v_coupon.discount_value, 0);
    END IF;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount);

  INSERT INTO public.orders (
    user_id, guest_token, guest_email, total_amount, subtotal, discount_amount,
    shipping_address, payment_method, status, currency, estimated_delivery,
    customer_name, customer_phone, customer_email, customer_note,
    shipping_line1, shipping_line2, shipping_city, shipping_state,
    shipping_postal_code, shipping_country, shipping_country_name
  ) VALUES (
    v_user, v_guest_token, p_email, v_total, v_subtotal, v_discount,
    p_shipping::text, v_payment_method, 'pending'::order_status, 'USD', v_estimated_delivery,
    v_ship_name, v_ship_phone, COALESCE(p_email, p_shipping->>'email'), v_ship_notes,
    v_ship_line1, v_ship_line2, v_ship_city, v_ship_state,
    v_ship_postal, v_ship_country, v_ship_country_name
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    SELECT id, title, price, gallery_urls INTO v_product
      FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    v_unit_price := v_product.price;
    v_title := v_product.title;
    v_image := COALESCE((v_item->>'image_url'), (v_product.gallery_urls)[1]);
    v_variant := NULL;

    IF (v_item->>'variant_id') IS NOT NULL AND length(v_item->>'variant_id') > 0 THEN
      SELECT id, value, additional_price INTO v_variant
        FROM public.product_variants
       WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;
      v_unit_price := v_unit_price + COALESCE(v_variant.additional_price, 0);
      v_title := v_title || ' (' || v_variant.value || ')';

      UPDATE public.product_variants
         SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty)
       WHERE id = v_variant.id;
    END IF;

    UPDATE public.products
       SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty),
           stock_status = CASE
             WHEN GREATEST(0, COALESCE(stock_quantity, 0) - v_qty) = 0 THEN 'out_of_stock'
             ELSE stock_status
           END,
           updated_at = now()
     WHERE id = v_product.id;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, title, quantity, unit_price, image_url, variant_label
    ) VALUES (
      v_order_id, v_product.id, NULLIF(v_item->>'variant_id','')::uuid,
      v_title, v_qty, v_unit_price, v_image, v_variant.value
    );
  END LOOP;

  INSERT INTO public.email_logs (to_address, subject, body, status)
  VALUES (
    COALESCE(p_email, (p_shipping->>'email')),
    'Order confirmation — ' || v_order_number,
    'Your order ' || v_order_number || ' has been received. Total: ' || v_total::text || ' USD. Payment method: ' || v_payment_method || '. Estimated delivery: ' || to_char(v_estimated_delivery, 'Mon DD, YYYY') || '.',
    'pending'
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'guest_token', v_guest_token,
    'total', v_total,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'payment_method', v_payment_method,
    'estimated_delivery', v_estimated_delivery
  );
END;
$function$;