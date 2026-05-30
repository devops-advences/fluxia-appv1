ALTER TABLE document
  ADD COLUMN source TEXT NOT NULL DEFAULT 'customer'
    CHECK (source IN ('customer', 'firm'));

ALTER TABLE document ALTER COLUMN source DROP DEFAULT;
