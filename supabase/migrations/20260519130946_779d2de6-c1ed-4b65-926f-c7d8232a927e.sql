CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read feature flags"
ON public.feature_flags FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage feature flags"
ON public.feature_flags FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_feature_flags
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

INSERT INTO public.feature_flags (key, label, description, category) VALUES
  ('cart', 'Shopping Cart', 'Enable cart functionality across the site', 'commerce'),
  ('checkout', 'Checkout', 'Allow customers to place orders', 'commerce'),
  ('guest_checkout', 'Guest Checkout', 'Allow checkout without account', 'commerce'),
  ('coupons', 'Coupons & Discounts', 'Coupon code input at checkout', 'commerce'),
  ('wishlist', 'Wishlist', 'Save products to wishlist', 'commerce'),
  ('product_reviews', 'Product Reviews', 'Show reviews and rating UI on product pages', 'commerce'),
  ('product_variants', 'Product Variants', 'Show size/color variant selectors', 'commerce'),
  ('returns', 'Returns & Refunds', 'Customer return request flow', 'commerce'),
  ('abandoned_cart_reminders', 'Abandoned Cart Reminders', 'Email/notify users who left items', 'commerce'),
  ('blog', 'Blog', 'Public blog section and nav link', 'content'),
  ('faq', 'FAQ', 'FAQ page', 'content'),
  ('help_center', 'Help Center', 'Help articles section', 'content'),
  ('dynamic_banners', 'Dynamic Banners', 'Homepage promo banners', 'content'),
  ('signup', 'User Signup', 'Allow new user registration', 'account'),
  ('social_login', 'Social Login', 'Google / social login providers', 'account'),
  ('profile_edit', 'Profile Edit', 'Users can edit profile info', 'account'),
  ('address_book', 'Address Book', 'Saved shipping addresses', 'account'),
  ('user_avatar_change', 'Avatar Change', 'Users can change their avatar', 'account'),
  ('affiliate_program', 'Affiliate Program', 'Affiliate dashboard and signup', 'marketing'),
  ('marketing_trackers', 'Marketing Trackers', 'Pixels / analytics scripts', 'marketing'),
  ('newsletter', 'Newsletter Signup', 'Email subscription form', 'marketing'),
  ('ai_chat', 'AI Chat Assistant', 'On-site AI chat widget', 'ai'),
  ('ai_blog_generation', 'AI Blog Generation', 'Automated blog post generation', 'ai'),
  ('ai_product_import', 'AI Product Import', 'AI-assisted product import', 'ai'),
  ('imgbb_uploads', 'ImgBB Uploads', 'Use ImgBB for image hosting', 'integrations'),
  ('image_optimization', 'Image Optimization', 'WebP conversion before upload', 'integrations'),
  ('supplier_sync', 'Supplier Stock Sync', 'Sync stock from supplier APIs', 'integrations')
ON CONFLICT (key) DO NOTHING;