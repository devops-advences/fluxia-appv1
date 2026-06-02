-- Colonne legal_entity_only sur fiscal_deadline
-- DEFAULT TRUE : toutes les règles existantes (sociétés) héritent TRUE automatiquement
ALTER TABLE fiscal_deadline
  ADD COLUMN legal_entity_only BOOLEAN NOT NULL DEFAULT TRUE;

-- ================================================================
-- Seed 2026 — Personnes physiques (legal_entity_only = FALSE)
-- ================================================================

-- ------
-- FRANCE
-- ------

-- IR — déclaration annuelle FY2025
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('FR', 2025, 'personal_income_tax', 'declaration', 'Déclaration IR 2025', '2025-01-01', '2025-12-31', '2026-05-31', false);

-- IR — acomptes provisionnels 2026 (fév/mai/aoû/nov)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('FR', 2026, 'personal_income_tax', 'installment', 'Acompte IR T1 2026', '2026-01-01', '2026-03-31', '2026-02-15', false),
  ('FR', 2026, 'personal_income_tax', 'installment', 'Acompte IR T2 2026', '2026-04-01', '2026-06-30', '2026-05-15', false),
  ('FR', 2026, 'personal_income_tax', 'installment', 'Acompte IR T3 2026', '2026-07-01', '2026-09-30', '2026-08-15', false),
  ('FR', 2026, 'personal_income_tax', 'installment', 'Acompte IR T4 2026', '2026-10-01', '2026-12-31', '2026-11-15', false);

-- Cotisations sociales — trimestrielles (jan/avr/jul/oct)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('FR', 2026, 'social_contributions', 'declaration', 'Cotisations sociales T1 2026', '2026-01-01', '2026-03-31', '2026-01-31', false),
  ('FR', 2026, 'social_contributions', 'declaration', 'Cotisations sociales T2 2026', '2026-04-01', '2026-06-30', '2026-04-30', false),
  ('FR', 2026, 'social_contributions', 'declaration', 'Cotisations sociales T3 2026', '2026-07-01', '2026-09-30', '2026-07-31', false),
  ('FR', 2026, 'social_contributions', 'declaration', 'Cotisations sociales T4 2026', '2026-10-01', '2026-12-31', '2026-10-31', false);


-- --------
-- TUNISIE
-- --------

-- IRPP — déclaration annuelle FY2025
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('TN', 2025, 'personal_income_tax', 'declaration', 'IRPP 2025', '2025-01-01', '2025-12-31', '2026-04-25', false);

-- IRPP — acomptes 2026 (×3 : juin/sep/déc)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('TN', 2026, 'personal_income_tax', 'installment', 'Acompte IRPP 1 2026', '2026-01-01', '2026-06-30', '2026-06-28', false),
  ('TN', 2026, 'personal_income_tax', 'installment', 'Acompte IRPP 2 2026', '2026-07-01', '2026-09-30', '2026-09-28', false),
  ('TN', 2026, 'personal_income_tax', 'installment', 'Acompte IRPP 3 2026', '2026-10-01', '2026-12-31', '2026-12-28', false);

-- CNSS — trimestrielle (mar/jun/sep/déc)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('TN', 2026, 'social_contributions', 'declaration', 'CNSS T1 2026', '2026-01-01', '2026-03-31', '2026-03-31', false),
  ('TN', 2026, 'social_contributions', 'declaration', 'CNSS T2 2026', '2026-04-01', '2026-06-30', '2026-06-30', false),
  ('TN', 2026, 'social_contributions', 'declaration', 'CNSS T3 2026', '2026-07-01', '2026-09-30', '2026-09-30', false),
  ('TN', 2026, 'social_contributions', 'declaration', 'CNSS T4 2026', '2026-10-01', '2026-12-31', '2026-12-31', false);


-- ------
-- MAROC
-- ------

-- IR — déclaration annuelle FY2025
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('MA', 2025, 'personal_income_tax', 'declaration', 'IR annuel 2025', '2025-01-01', '2025-12-31', '2026-03-31', false);

-- IR — acomptes 2026 (×4 : mar/jun/sep/déc)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('MA', 2026, 'personal_income_tax', 'installment', 'Acompte IR T1 2026', '2026-01-01', '2026-03-31', '2026-03-31', false),
  ('MA', 2026, 'personal_income_tax', 'installment', 'Acompte IR T2 2026', '2026-04-01', '2026-06-30', '2026-06-30', false),
  ('MA', 2026, 'personal_income_tax', 'installment', 'Acompte IR T3 2026', '2026-07-01', '2026-09-30', '2026-09-30', false),
  ('MA', 2026, 'personal_income_tax', 'installment', 'Acompte IR T4 2026', '2026-10-01', '2026-12-31', '2026-12-31', false);

-- CNSS — trimestrielle (mar/jun/sep/déc)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date, legal_entity_only) VALUES
  ('MA', 2026, 'social_contributions', 'declaration', 'CNSS T1 2026', '2026-01-01', '2026-03-31', '2026-03-31', false),
  ('MA', 2026, 'social_contributions', 'declaration', 'CNSS T2 2026', '2026-04-01', '2026-06-30', '2026-06-30', false),
  ('MA', 2026, 'social_contributions', 'declaration', 'CNSS T3 2026', '2026-07-01', '2026-09-30', '2026-09-30', false),
  ('MA', 2026, 'social_contributions', 'declaration', 'CNSS T4 2026', '2026-10-01', '2026-12-31', '2026-12-31', false);


-- ================================================================
-- Mise à jour des fonctions generate — filtre legal_entity_only
-- ================================================================

CREATE OR REPLACE FUNCTION generate_firm_obligations(p_firm_id UUID, p_year SMALLINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_data WHERE id = auth.uid() AND firm_id = p_firm_id
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO tax_obligation (
    customer_id, fiscal_deadline_id,
    label, tax_type, event_type,
    due_date, year, payment_mode
  )
  SELECT c.id, fd.id, fd.label, fd.tax_type, fd.event_type,
         fd.due_date, fd.year, c.default_payment_mode
  FROM customer c
  JOIN fiscal_deadline fd
    ON fd.country_code        = c.country_code
    AND fd.year               = p_year
    AND fd.legal_entity_only  = c.legal_entity
  WHERE c.firm_id = p_firm_id
    AND c.active  = true
  ON CONFLICT (customer_id, fiscal_deadline_id)
  DO UPDATE SET payment_mode = EXCLUDED.payment_mode
  WHERE tax_obligation.payment_mode IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_firm_obligations(UUID, SMALLINT) TO authenticated;


CREATE OR REPLACE FUNCTION generate_customer_obligations(p_customer_id UUID, p_year SMALLINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_customer WHERE user_id = auth.uid() AND customer_id = p_customer_id
  ) AND NOT EXISTS (
    SELECT 1 FROM user_data ud
    JOIN customer c ON c.firm_id = ud.firm_id
    WHERE ud.id = auth.uid() AND c.id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO tax_obligation (
    customer_id, fiscal_deadline_id,
    label, tax_type, event_type,
    due_date, year, payment_mode
  )
  SELECT c.id, fd.id, fd.label, fd.tax_type, fd.event_type,
         fd.due_date, fd.year, c.default_payment_mode
  FROM customer c
  JOIN fiscal_deadline fd
    ON fd.country_code        = c.country_code
    AND fd.year               = p_year
    AND fd.legal_entity_only  = c.legal_entity
  WHERE c.id = p_customer_id
  ON CONFLICT (customer_id, fiscal_deadline_id)
  DO UPDATE SET payment_mode = EXCLUDED.payment_mode
  WHERE tax_obligation.payment_mode IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_customer_obligations(UUID, SMALLINT) TO authenticated;
