-- Aligne audit_run/audit_finding sur la règle déjà en place ailleurs (document, recurring_task_status) :
-- les admins cab voient tout, les non-admins voient uniquement les dossiers qui leur sont assignés (user_customer).
-- is_admin() existe déjà (migration 20260531000004_rls_collaborator_access.sql).

DROP POLICY IF EXISTS "audit_run_select_firm" ON audit_run;

CREATE POLICY "audit_run_select_firm" ON audit_run
  FOR SELECT TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
    AND (
      is_admin()
      OR customer_id IN (SELECT customer_id FROM user_customer WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "audit_finding_select_firm" ON audit_finding;

CREATE POLICY "audit_finding_select_firm" ON audit_finding
  FOR SELECT TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
    AND (
      is_admin()
      OR customer_id IN (SELECT customer_id FROM user_customer WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "audit_finding_update_firm" ON audit_finding;

CREATE POLICY "audit_finding_update_firm" ON audit_finding
  FOR UPDATE TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
    AND (
      is_admin()
      OR customer_id IN (SELECT customer_id FROM user_customer WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    firm_id = my_firm_id()
    AND status IN ('open', 'ignored')
  );
