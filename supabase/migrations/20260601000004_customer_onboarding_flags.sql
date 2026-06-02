ALTER TABLE customer
  ADD COLUMN employees_none BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN accounts_none  BOOLEAN NOT NULL DEFAULT false;
