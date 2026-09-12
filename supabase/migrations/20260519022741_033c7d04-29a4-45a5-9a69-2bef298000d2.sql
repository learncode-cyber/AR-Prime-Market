
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_simple();

-- api_credentials: admin-only, deny everything else
CREATE POLICY "Admins manage api_credentials"
  ON public.api_credentials
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anon api_credentials"
  ON public.api_credentials
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- product_images: public read, admin manage
CREATE POLICY "Public read product_images"
  ON public.product_images
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage product_images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- import_logs: admin-only
CREATE POLICY "Admins manage import_logs"
  ON public.import_logs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
