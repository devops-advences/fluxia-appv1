-- bank est un référentiel global géré par master uniquement
-- Suppression de firm_id et des policies firm associées

-- Supprimer d'abord toutes les policies qui référencent firm_id
DROP POLICY IF EXISTS "bank_select"      ON bank;
DROP POLICY IF EXISTS "bank_insert_firm" ON bank;
DROP POLICY IF EXISTS "bank_update_firm" ON bank;
DROP POLICY IF EXISTS "bank_delete_firm" ON bank;

-- Ensuite supprimer la colonne
ALTER TABLE bank DROP COLUMN IF EXISTS firm_id;

-- Lecture : tous les authentifiés (référentiel global)
CREATE POLICY "bank_select" ON bank
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE réservés au service_role (master via API dédiée)
REVOKE INSERT, UPDATE, DELETE ON bank FROM authenticated;
