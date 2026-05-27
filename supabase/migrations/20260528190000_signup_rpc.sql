-- RPC appelée côté client après supabase.auth.signUp()
-- Crée le cabinet + user_data de l'admin en une transaction
CREATE OR REPLACE FUNCTION create_cabinet(
  p_firm_name    TEXT,
  p_slug         TEXT,
  p_country_code CHAR(2),
  p_first_name   TEXT,
  p_last_name    TEXT
) RETURNS UUID AS $$
DECLARE
  v_firm_id UUID;
BEGIN
  INSERT INTO firm (name, slug, country_code)
  VALUES (p_firm_name, p_slug, p_country_code)
  RETURNING id INTO v_firm_id;

  INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin)
  VALUES (auth.uid(), v_firm_id, 'firm', p_first_name, p_last_name, true);

  RETURN v_firm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_cabinet TO authenticated;
