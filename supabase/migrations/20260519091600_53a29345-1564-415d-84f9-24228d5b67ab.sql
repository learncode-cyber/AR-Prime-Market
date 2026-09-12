
-- Insert default image optimization settings row (no secret needed - settings only)
INSERT INTO public.integration_settings (provider, extra_config, is_active, updated_at)
VALUES (
  'image_optimization',
  jsonb_build_object(
    'enabled', true,
    'format', 'webp',
    'quality', 82,
    'max_width', 2000,
    'skip_animated', true
  ),
  true,
  now()
)
ON CONFLICT (provider) DO NOTHING;
