-- Génère les obligations pour un client spécifique
-- Callable par le customer lui-même (via user_customer) ou par un membre du cabinet
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
  SELECT
    c.id, fd.id, fd.label, fd.tax_type, fd.event_type,
    fd.due_date, fd.year, c.default_payment_mode
  FROM customer c
  JOIN fiscal_deadline fd
    ON fd.country_code = c.country_code
    AND fd.year = p_year
  WHERE c.id = p_customer_id
  ON CONFLICT (customer_id, fiscal_deadline_id)
  DO UPDATE SET payment_mode = EXCLUDED.payment_mode
  WHERE tax_obligation.payment_mode IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_customer_obligations(UUID, SMALLINT) TO authenticated;
