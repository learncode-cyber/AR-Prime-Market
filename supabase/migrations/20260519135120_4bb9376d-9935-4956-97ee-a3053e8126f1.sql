
CREATE UNIQUE INDEX IF NOT EXISTS api_credentials_provider_key ON public.api_credentials(provider);

DELETE FROM public.api_credentials WHERE provider = 'steadfast';
INSERT INTO public.api_credentials (provider, label, credentials, is_active)
VALUES ('steadfast', 'SteadFast Courier',
  '{"api_key":"9ro9j96ondwihekmzobjq6nrbf5htjt9","secret_key":"8krparp3asajsi0vhsblhwxs"}'::jsonb,
  true);
