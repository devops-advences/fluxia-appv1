-- Les logos banques vont dans le bucket existant "logos" sous bank/
-- (bucket bank-logos supprimé via CLI)

DROP POLICY IF EXISTS "bank_logos_public_read" ON storage.objects;

-- Lecture publique pour logos/bank/*
CREATE POLICY "logos_bank_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos' AND name LIKE 'bank/%');
