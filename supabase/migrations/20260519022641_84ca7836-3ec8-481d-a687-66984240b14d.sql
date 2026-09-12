
-- ========== STEP 1: Add missing columns to existing tables ==========

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cogs NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_url TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS option1_name TEXT,
  ADD COLUMN IF NOT EXISTS option1_value TEXT,
  ADD COLUMN IF NOT EXISTS option2_name TEXT,
  ADD COLUMN IF NOT EXISTS option2_value TEXT,
  ADD COLUMN IF NOT EXISTS cogs NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS external_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_country_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country_name TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS fulfillment_channel TEXT,
  ADD COLUMN IF NOT EXISTS supplier_order_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_consignment_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_note TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_title TEXT,
  ADD COLUMN IF NOT EXISTS variant_title TEXT,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cogs NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier_product_id TEXT,
  ADD COLUMN IF NOT EXISTS supplier_variant_id TEXT;

-- ========== STEP 2: Create 3 new tables ==========

CREATE TABLE IF NOT EXISTS public.api_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT,
  input_url TEXT,
  status TEXT DEFAULT 'pending',
  product_id UUID REFERENCES public.products(id),
  error_message TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== STEP 3: updated_at trigger ==========

CREATE OR REPLACE FUNCTION public.update_updated_at_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;