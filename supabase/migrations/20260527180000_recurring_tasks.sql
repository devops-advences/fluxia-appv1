-- ============================================================
-- Recurring tasks : obligations récurrentes cab ↔ client
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE recurring_task (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  customer_task BOOLEAN     NOT NULL DEFAULT false,
  due_months    INT[]       NOT NULL,
  country_code  CHAR(2)     NOT NULL,
  firm_id       UUID        REFERENCES firm(id) ON DELETE CASCADE,
  rank          INT         NOT NULL DEFAULT 0,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring_task_status (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id UUID        NOT NULL REFERENCES recurring_task(id) ON DELETE CASCADE,
  firm_id           UUID        NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  customer_id       UUID        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  year              INT         NOT NULL,
  month             SMALLINT    NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'done', 'done_late', 'late')),
  comment           TEXT,
  updated_by        UUID        REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurring_task_id, firm_id, customer_id, year, month)
);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE recurring_task        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_task_status ENABLE ROW LEVEL SECURITY;

-- recurring_task : tous les users authentifiés lisent
-- firm admin insère/modifie/supprime les tâches custom de leur firm
-- master gère tout
CREATE POLICY "recurring_task_select" ON recurring_task
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recurring_task_insert_firm" ON recurring_task
  FOR INSERT TO authenticated
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid())
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  );

CREATE POLICY "recurring_task_update_firm" ON recurring_task
  FOR UPDATE TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid())
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid())
  );

CREATE POLICY "recurring_task_delete_firm" ON recurring_task
  FOR DELETE TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid())
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  );

-- recurring_task_status : lecture + écriture par les users firm du tenant
CREATE POLICY "recurring_task_status_select" ON recurring_task_status
  FOR SELECT TO authenticated
  USING (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "recurring_task_status_insert" ON recurring_task_status
  FOR INSERT TO authenticated
  WITH CHECK (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "recurring_task_status_update" ON recurring_task_status
  FOR UPDATE TO authenticated
  USING (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()))
  WITH CHECK (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "recurring_task_status_delete" ON recurring_task_status
  FOR DELETE TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid())
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  );

-- ── Seed : tâches standard ───────────────────────────────────

INSERT INTO recurring_task (name, customer_task, due_months, country_code, rank) VALUES

  -- ── France : cabinet ────────────────────────────────────
  ('TVA mensuelle',          false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 10),
  ('TVA trimestrielle',      false, ARRAY[4,7,10,1],                    'FR', 20),
  ('Acomptes IS',            false, ARRAY[3,6,9,12],                    'FR', 30),
  ('Liasse fiscale / Bilan', false, ARRAY[4],                           'FR', 40),
  ('DSN',                    false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 50),
  ('DAS2',                   false, ARRAY[1],                           'FR', 60),
  ('CFE',                    false, ARRAY[12],                          'FR', 70),
  ('Taxe d''apprentissage',  false, ARRAY[5],                           'FR', 80),
  ('AG approbation comptes', false, ARRAY[6],                           'FR', 90),

  -- ── France : client ─────────────────────────────────────
  ('Relevés bancaires',            true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 110),
  ('Factures fournisseurs',        true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 120),
  ('Notes de frais',               true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 130),
  ('Variables de paie',            true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 140),
  ('Relevé de caisse',             true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'FR', 150),
  ('Justificatifs immobilisations',true, ARRAY[1],                           'FR', 160),

  -- ── Tunisie : cabinet ────────────────────────────────────
  ('TVA mensuelle',            false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 10),
  ('Retenues à la source',     false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 20),
  ('Acomptes IS',              false, ARRAY[6,9,12],                      'TN', 30),
  ('Déclaration IS annuelle',  false, ARRAY[3],                           'TN', 40),
  ('TCL',                      false, ARRAY[4,7,10,1],                    'TN', 50),
  ('Droit de timbre',          false, ARRAY[4,7,10,1],                    'TN', 60),
  ('TFP',                      false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 70),
  ('FOPROLOS',                 false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 80),
  ('Déclaration employeur',    false, ARRAY[4],                           'TN', 90),
  ('Bilan / États financiers', false, ARRAY[3],                           'TN', 100),

  -- ── Tunisie : client ─────────────────────────────────────
  ('Relevés bancaires',     true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 110),
  ('Factures fournisseurs', true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 120),
  ('Notes de frais',        true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 130),
  ('Variables de paie',     true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'TN', 140),

  -- ── Maroc : cabinet ──────────────────────────────────────
  ('TVA mensuelle',           false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 10),
  ('Retenues à la source',    false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 20),
  ('CNSS',                    false, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 30),
  ('Acomptes IS',             false, ARRAY[3,6,9,12],                    'MA', 40),
  ('Déclaration IS annuelle', false, ARRAY[3],                           'MA', 50),
  ('Taxe professionnelle',    false, ARRAY[1],                           'MA', 60),

  -- ── Maroc : client ───────────────────────────────────────
  ('Relevés bancaires',     true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 110),
  ('Factures fournisseurs', true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 120),
  ('Notes de frais',        true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 130),
  ('Variables de paie',     true, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 'MA', 140);
