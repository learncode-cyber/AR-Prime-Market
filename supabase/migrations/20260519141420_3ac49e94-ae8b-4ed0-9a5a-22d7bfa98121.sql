INSERT INTO public.feature_flags (key, label, category, is_enabled, description)
VALUES ('ai_shopping_agent', 'AI Shopping Agent (Floating)', 'ai', true, 'Floating bottom-right AI shopping assistant for all visitors. Turn OFF to instantly remove it for everyone.')
ON CONFLICT (key) DO NOTHING;