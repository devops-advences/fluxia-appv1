-- Fix RLS tax_obligation : remplace subquery user_data par my_firm_id()
DROP POLICY IF EXISTS "tax_obligation_firm_access"  ON tax_obligation;
DROP POLICY IF EXISTS "tax_obligation_customer_read" ON tax_obligation;

-- Cab : accès complet à toutes les obligations de ses clients
CREATE POLICY "tax_obligation_firm_access" ON tax_obligation
  FOR ALL TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE firm_id = my_firm_id())
  );

-- Client : lecture seule de ses propres obligations
CREATE POLICY "tax_obligation_customer_read" ON tax_obligation
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );
