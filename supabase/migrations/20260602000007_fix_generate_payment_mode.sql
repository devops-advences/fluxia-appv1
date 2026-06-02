-- Propage default_payment_mode sur les obligations existantes où payment_mode est NULL
UPDATE tax_obligation o
SET payment_mode = c.default_payment_mode
FROM customer c
WHERE o.customer_id = c.id
  AND o.payment_mode IS NULL
  AND c.default_payment_mode IS NOT NULL;

-- Corrige la fonction generate : DO UPDATE payment_mode si NULL (mode non saisi manuellement)
CREATE OR REPLACE FUNCTION generate_firm_obligations(p_firm_id UUID, p_year SMALLINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
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
  ON CONFLICT (customer_id, fiscal_deadline_id)
  DO UPDATE SET payment_mode = EXCLUDED.payment_mode
  WHERE tax_obligation.payment_mode IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_firm_obligations(UUID, SMALLINT) TO authenticated;
