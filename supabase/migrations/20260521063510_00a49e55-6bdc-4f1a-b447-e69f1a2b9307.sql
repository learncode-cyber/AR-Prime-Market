INSERT INTO public.marketing_trackers (provider, tracker_id, is_active)
VALUES ('facebook_pixel', '2382736205496567', true)
ON CONFLICT (provider) DO UPDATE
  SET tracker_id = EXCLUDED.tracker_id,
      is_active = true,
      updated_at = now();