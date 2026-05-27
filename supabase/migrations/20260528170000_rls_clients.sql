-- Firm users can see user_customer links for their firm's customers
CREATE POLICY "user_customer_select_firm_customers" ON user_customer
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE firm_id = my_firm_id())
  );

-- Firm users can manage user_customer links for their firm's customers
CREATE POLICY "user_customer_insert_firm" ON user_customer
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM customer WHERE firm_id = my_firm_id())
  );

CREATE POLICY "user_customer_delete_firm" ON user_customer
  FOR DELETE TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE firm_id = my_firm_id())
  );
