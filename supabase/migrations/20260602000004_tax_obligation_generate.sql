-- Colonne year sur tax_obligation (= année fiscale, depuis fiscal_deadline.year)
ALTER TABLE tax_obligation ADD COLUMN year SMALLINT;

-- Contrainte unique pour éviter les doublons à la génération
ALTER TABLE tax_obligation
  ADD CONSTRAINT uq_tax_obligation_customer_deadline
  UNIQUE (customer_id, fiscal_deadline_id);

-- Fonction : génère les obligations manquantes pour tous les clients actifs d'un cabinet
CREATE OR REPLACE FUNCTION generate_firm_obligations(p_firm_id UUID, p_year SMALLINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Vérifie que l'appelant appartient au cabinet
  IF NOT EXISTS (
    SELECT 1 FROM user_data WHERE id = auth.uid() AND firm_id = p_firm_id
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO tax_obligation (
    customer_id, fiscal_deadline_id,
    label, tax_type, event_type,
    due_date, year,
    payment_mode
  )
  SELECT
    c.id,
    fd.id,
    fd.label,
    fd.tax_type,
    fd.event_type,
    fd.due_date,
    fd.year,
    c.default_payment_mode
  FROM customer c
  JOIN fiscal_deadline fd
    ON fd.country_code = c.country_code
    AND fd.year        = p_year
  WHERE c.firm_id = p_firm_id
    AND c.active  = true
  ON CONFLICT (customer_id, fiscal_deadline_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_firm_obligations(UUID, SMALLINT) TO authenticated;
