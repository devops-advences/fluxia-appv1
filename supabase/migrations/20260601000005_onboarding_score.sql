-- ============================================================
-- Onboarding score par client
-- ============================================================

ALTER TABLE customer ADD COLUMN onboarding_score INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION refresh_onboarding_score(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_score   INT := 0;
  v_cust    customer%ROWTYPE;
BEGIN
  SELECT * INTO v_cust FROM customer WHERE id = p_customer_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Données générales (20pts) : tax_ref_main renseigné
  IF v_cust.tax_ref_main IS NOT NULL AND v_cust.tax_ref_main != '' THEN
    v_score := v_score + 20;
  END IF;

  -- Comptes bancaires (15pts) : ≥1 compte OU accounts_none = true
  IF v_cust.accounts_none OR EXISTS (
    SELECT 1 FROM customer_bank_account WHERE customer_id = p_customer_id
  ) THEN
    v_score := v_score + 15;
  END IF;

  -- Salariés (15pts) : ≥1 salarié actif OU employees_none = true
  IF v_cust.employees_none OR EXISTS (
    SELECT 1 FROM customer_employee WHERE customer_id = p_customer_id AND active = true
  ) THEN
    v_score := v_score + 15;
  END IF;

  -- Services (20pts) : ≥1 service actif
  IF EXISTS (
    SELECT 1 FROM customer_service WHERE customer_id = p_customer_id AND active = true
  ) THEN
    v_score := v_score + 20;
  END IF;

  -- Utilisateurs (30pts) : ≥1 user client actif
  IF EXISTS (
    SELECT 1 FROM user_customer uc
    JOIN user_data ud ON ud.id = uc.user_id
    WHERE uc.customer_id = p_customer_id
      AND ud.active = true
      AND ud.role = 'customer'
  ) THEN
    v_score := v_score + 30;
  END IF;

  UPDATE customer SET onboarding_score = v_score WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_onboarding_score TO authenticated, service_role;

-- Population initiale
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM customer LOOP
    PERFORM refresh_onboarding_score(r.id);
  END LOOP;
END $$;
