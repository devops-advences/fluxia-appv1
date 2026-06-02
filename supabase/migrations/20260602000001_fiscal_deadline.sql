CREATE TABLE fiscal_deadline (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  year         SMALLINT NOT NULL,
  tax_type     TEXT NOT NULL,
  -- 'value_added_tax' | 'corporate_income_tax' | 'personal_income_tax'
  -- 'social_contributions' | 'withholding_tax'
  event_type   TEXT NOT NULL,
  -- 'declaration' | 'payment' | 'installment'
  label        TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  due_date     DATE NOT NULL
);

CREATE INDEX idx_fiscal_deadline_lookup
  ON fiscal_deadline (country_code, year, tax_type);
