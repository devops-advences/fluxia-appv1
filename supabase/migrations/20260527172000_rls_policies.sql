-- Enable RLS on all tables
ALTER TABLE firm ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_customer ENABLE ROW LEVEL SECURITY;

-- user_data: each user sees their own row
CREATE POLICY "user_data_select_own" ON user_data
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "user_data_update_own" ON user_data
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- firm: users see their own firm
CREATE POLICY "firm_select_own" ON firm
  FOR SELECT TO authenticated
  USING (id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "firm_update_own" ON firm
  FOR UPDATE TO authenticated
  USING (id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

-- customer: firm users see their firm's customers
CREATE POLICY "customer_select_own_firm" ON customer
  FOR SELECT TO authenticated
  USING (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "customer_insert_own_firm" ON customer
  FOR INSERT TO authenticated
  WITH CHECK (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

CREATE POLICY "customer_update_own_firm" ON customer
  FOR UPDATE TO authenticated
  USING (firm_id = (SELECT firm_id FROM user_data WHERE id = auth.uid()));

-- user_customer: users see their own links
CREATE POLICY "user_customer_select_own" ON user_customer
  FOR SELECT TO authenticated USING (user_id = auth.uid());
