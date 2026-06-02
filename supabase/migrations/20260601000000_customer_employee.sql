-- ============================================================
-- Salariés des clients
-- ============================================================

CREATE TABLE customer_employee (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID        NOT NULL REFERENCES firm(id)     ON DELETE CASCADE,
  customer_id   UUID        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  civility      TEXT,
  last_name     TEXT        NOT NULL,
  first_name    TEXT        NOT NULL,
  birth_date    DATE,
  identity_ref  TEXT,
  social_ref    TEXT,
  contract_type TEXT        CHECK (contract_type IN ('CDI','CDD','Intérim','Stage','Alternance')),
  job_title     TEXT,
  entry_date    DATE,
  exit_date     DATE,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customer_employee_updated_at
  BEFORE UPDATE ON customer_employee
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE customer_employee ENABLE ROW LEVEL SECURITY;

-- Firm users : voient tous les salariés de leur firm
CREATE POLICY "ce_select_firm" ON customer_employee
  FOR SELECT TO authenticated
  USING (firm_id = my_firm_id());

CREATE POLICY "ce_insert_firm" ON customer_employee
  FOR INSERT TO authenticated
  WITH CHECK (firm_id = my_firm_id());

CREATE POLICY "ce_update_firm" ON customer_employee
  FOR UPDATE TO authenticated
  USING (firm_id = my_firm_id());

CREATE POLICY "ce_delete_firm" ON customer_employee
  FOR DELETE TO authenticated
  USING (firm_id = my_firm_id());

-- Customer users : voient les salariés de leur propre customer
CREATE POLICY "ce_select_customer" ON customer_employee
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ce_insert_customer" ON customer_employee
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ce_update_customer" ON customer_employee
  FOR UPDATE TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ce_delete_customer" ON customer_employee
  FOR DELETE TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

-- ── Grants ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_employee TO authenticated;
