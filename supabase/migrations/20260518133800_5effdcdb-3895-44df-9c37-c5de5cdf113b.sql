
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Storage policies for return-images bucket
CREATE POLICY "Users upload own return images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'return-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users read own return images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'return-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users delete own return images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'return-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
