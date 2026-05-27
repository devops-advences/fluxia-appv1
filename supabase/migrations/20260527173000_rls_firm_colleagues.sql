-- Helper function to get current user's firm_id (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION my_firm_id()
RETURNS UUID AS $$
  SELECT firm_id FROM user_data WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Allow firm users to see all users in their firm
CREATE POLICY "user_data_select_same_firm" ON user_data
  FOR SELECT TO authenticated
  USING (firm_id = my_firm_id());
