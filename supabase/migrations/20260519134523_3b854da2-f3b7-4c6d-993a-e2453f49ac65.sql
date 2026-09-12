
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS target_markets text[] NOT NULL DEFAULT ARRAY['worldwide']::text[];

UPDATE public.products SET target_markets = ARRAY['bangladesh','worldwide']
  WHERE source = 'manual' OR source IS NULL;

UPDATE public.products SET target_markets = ARRAY['worldwide']
  WHERE source IN ('cj_dropshipping','aliexpress');

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_target_markets_valid;

ALTER TABLE public.products
  ADD CONSTRAINT products_target_markets_valid
  CHECK (target_markets <@ ARRAY['bangladesh','worldwide']::text[] AND array_length(target_markets,1) >= 1);
