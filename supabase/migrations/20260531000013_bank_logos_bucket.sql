-- Bucket public pour les logos banques (géré par master)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bank-logos', 'bank-logos', true, 524288, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bank_logos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'bank-logos');
