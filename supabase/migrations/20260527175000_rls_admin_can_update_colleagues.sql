-- Admins can update the admin field of other firm users (not themselves)
CREATE POLICY "user_data_update_colleague_role" ON user_data
  FOR UPDATE TO authenticated
  USING (
    firm_id = my_firm_id()
    AND id != auth.uid()
    AND (SELECT admin FROM user_data WHERE id = auth.uid())
  );
