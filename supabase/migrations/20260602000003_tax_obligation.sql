-- default_payment_mode sur customer
ALTER TABLE customer
  ADD COLUMN default_payment_mode TEXT;
-- 'direct_debit' | 'bank_transfer' | 'cheque' | 'cash'

-- Échéances fiscales par client
CREATE TABLE tax_obligation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  fiscal_deadline_id  UUID REFERENCES fiscal_deadline(id),

  label               TEXT NOT NULL,
  tax_type            TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  due_date            DATE NOT NULL,

  amount              NUMERIC(12, 2),
  payment_mode        TEXT,
  -- 'direct_debit' | 'bank_transfer' | 'cheque' | 'cash'
  -- NULL = hérite de customer.default_payment_mode

  status              TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'paid' | 'rejected' | 'failed'

  alert_days_before   SMALLINT DEFAULT 7,
  alerted_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_obligation_customer ON tax_obligation (customer_id, due_date);
CREATE INDEX idx_tax_obligation_firm ON tax_obligation (customer_id, status, due_date);

CREATE TRIGGER tax_obligation_updated_at
  BEFORE UPDATE ON tax_obligation FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE tax_obligation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_obligation_firm_access" ON tax_obligation
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customer c
      JOIN user_data u ON u.firm_id = c.firm_id
      WHERE c.id = tax_obligation.customer_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "tax_obligation_customer_read" ON tax_obligation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_customer uc
      WHERE uc.customer_id = tax_obligation.customer_id
        AND uc.user_id = auth.uid()
    )
  );
