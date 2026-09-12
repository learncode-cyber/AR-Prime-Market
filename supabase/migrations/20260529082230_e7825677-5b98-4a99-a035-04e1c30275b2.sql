-- Home category cards (admin-controlled "Amazon-style" home section)
CREATE TABLE public.home_category_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cta_label text NOT NULL DEFAULT 'See more',
  target_slug text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_category_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_category_cards TO authenticated;
GRANT ALL ON public.home_category_cards TO service_role;

ALTER TABLE public.home_category_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active home_category_cards"
  ON public.home_category_cards FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage home_category_cards"
  ON public.home_category_cards FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_home_category_cards_updated_at
  BEFORE UPDATE ON public.home_category_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- Items inside each card
CREATE TABLE public.home_category_card_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.home_category_cards(id) ON DELETE CASCADE,
  label text NOT NULL,
  image_url text NOT NULL,
  search_query text,
  target_slug text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_category_card_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_category_card_items TO authenticated;
GRANT ALL ON public.home_category_card_items TO service_role;

ALTER TABLE public.home_category_card_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read home_category_card_items"
  ON public.home_category_card_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.home_category_cards c
      WHERE c.id = card_id AND c.is_active = true
    )
  );

CREATE POLICY "Admins manage home_category_card_items"
  ON public.home_category_card_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_home_category_card_items_card_id ON public.home_category_card_items(card_id);

-- Seed: replicate the current hardcoded 6 cards + 24 items
DO $$
DECLARE
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid();
  c6 uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.home_category_cards (id, title, cta_label, target_slug, position) VALUES
    (c1, 'Level up your beauty routine', 'See more', 'beauty', 0),
    (c2, 'Gear up to get fit', 'Discover more', 'sports', 1),
    (c3, 'Level up your PC here', 'Discover more', 'electronics', 2),
    (c4, 'Deals on top categories', 'Discover more', 'fashion', 3),
    (c5, 'Travel essentials', 'Discover more', 'accessories', 4),
    (c6, 'Home & kitchen finds', 'Discover more', 'home', 5);

  INSERT INTO public.home_category_card_items (card_id, label, image_url, search_query, position) VALUES
    (c1, 'Makeup', 'https://images.unsplash.com/photo-1522335789203-aaa01b2c8a0a?w=400&q=80&auto=format&fit=crop', 'makeup', 0),
    (c1, 'Brushes', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop', 'brush', 1),
    (c1, 'Skincare', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80&auto=format&fit=crop', 'skincare', 2),
    (c1, 'Fragrance', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80&auto=format&fit=crop', 'perfume', 3),
    (c2, 'Clothing', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&q=80&auto=format&fit=crop', 'sport clothing', 0),
    (c2, 'Trackers', 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&q=80&auto=format&fit=crop', 'fitness tracker', 1),
    (c2, 'Equipment', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80&auto=format&fit=crop', 'gym equipment', 2),
    (c2, 'Shoes', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80&auto=format&fit=crop', 'sport shoes', 3),
    (c3, 'Laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80&auto=format&fit=crop', 'laptop', 0),
    (c3, 'PCs', 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&q=80&auto=format&fit=crop', 'desktop pc', 1),
    (c3, 'Hard Drives', 'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80&auto=format&fit=crop', 'ssd', 2),
    (c3, 'Monitors', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80&auto=format&fit=crop', 'monitor', 3),
    (c4, 'Books', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80&auto=format&fit=crop', 'book', 0),
    (c4, 'Fashion', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80&auto=format&fit=crop', 'jacket', 1),
    (c4, 'Gadgets', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop', 'gadget', 2),
    (c4, 'Home', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80&auto=format&fit=crop', 'home decor', 3),
    (c5, 'Luggage', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80&auto=format&fit=crop', 'luggage', 0),
    (c5, 'Backpacks', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80&auto=format&fit=crop', 'backpack', 1),
    (c5, 'Organizers', 'https://images.unsplash.com/photo-1581553680321-4fffae59fccd?w=400&q=80&auto=format&fit=crop', 'travel organizer', 2),
    (c5, 'Adapters', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80&auto=format&fit=crop', 'travel adapter', 3),
    (c6, 'Decor', 'https://images.unsplash.com/photo-1513161455079-7dc1de15ef3e?w=400&q=80&auto=format&fit=crop', 'decor', 0),
    (c6, 'Kitchen', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80&auto=format&fit=crop', 'kitchen', 1),
    (c6, 'Bedding', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=80&auto=format&fit=crop', 'bedding', 2),
    (c6, 'Lighting', 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&q=80&auto=format&fit=crop', 'lamp', 3);
END $$;