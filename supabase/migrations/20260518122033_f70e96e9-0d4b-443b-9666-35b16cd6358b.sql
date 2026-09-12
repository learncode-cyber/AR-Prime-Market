
-- payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  display_name_bn text,
  icon_name text,
  is_active boolean NOT NULL DEFAULT true,
  instructions text,
  instructions_bn text,
  sort_order integer NOT NULL DEFAULT 0,
  wallet_address text,
  deposit_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment_methods" ON public.payment_methods
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Deny direct payment_methods read" ON public.payment_methods
  FOR SELECT TO anon, authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE VIEW public.payment_methods_public
WITH (security_invoker=on) AS
  SELECT id, method_key, display_name, display_name_bn, icon_name,
         is_active, instructions, instructions_bn, sort_order
  FROM public.payment_methods
  WHERE is_active = true;
GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

-- shipping_rates
CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  shipping_type text NOT NULL,
  base_cost numeric NOT NULL DEFAULT 0,
  per_kg_cost numeric NOT NULL DEFAULT 0,
  min_days integer NOT NULL DEFAULT 1,
  max_days integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shipping_rates" ON public.shipping_rates
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Public read active shipping_rates" ON public.shipping_rates
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'custom',
  api_endpoint text,
  api_key_ref text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- translations
CREATE TABLE IF NOT EXISTS public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL,
  content_key text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language_code, content_key)
);
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage translations" ON public.translations
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Public read translations" ON public.translations
  FOR SELECT TO anon, authenticated USING (true);

-- Seed payment methods
INSERT INTO public.payment_methods (method_key, display_name, display_name_bn, icon_name, sort_order, instructions)
VALUES
  ('cod','Cash on Delivery','ক্যাশ অন ডেলিভারি','banknote',1,'Pay in cash when you receive the order.'),
  ('bkash','bKash','বিকাশ','smartphone',2,'Send money to our bKash merchant number.'),
  ('nagad','Nagad','নগদ','smartphone',3,'Send money to our Nagad merchant number.'),
  ('rocket','Rocket','রকেট','smartphone',4,'Send money to our Rocket number.'),
  ('binance','Binance Pay','বাইন্যান্স পে','bitcoin',5,'Pay via Binance Pay ID.'),
  ('bank_transfer','Bank Transfer','ব্যাংক ট্রান্সফার','building-2',6,'Transfer to our bank account.'),
  ('card','Card','কার্ড','credit-card',7,'Pay with debit or credit card.')
ON CONFLICT (method_key) DO NOTHING;

-- Seed shipping rates
INSERT INTO public.shipping_rates (zone_name, shipping_type, base_cost, per_kg_cost, min_days, max_days)
VALUES
  ('Dhaka City','inside_dhaka',60,0,1,2),
  ('Dhaka City','express',120,0,1,1),
  ('Outside Dhaka','outside_dhaka',120,10,3,5),
  ('Outside Dhaka','express',200,15,2,3)
ON CONFLICT DO NOTHING;
