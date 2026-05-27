ALTER TABLE user_invitation ENABLE ROW LEVEL SECURITY;

-- Firm users see their firm's invitations
CREATE POLICY "invitation_select_own_firm" ON user_invitation
  FOR SELECT TO authenticated
  USING (firm_id = my_firm_id());

-- Admins can create invitations for their firm
CREATE POLICY "invitation_insert_admin" ON user_invitation
  FOR INSERT TO authenticated
  WITH CHECK (
    firm_id = my_firm_id()
    AND (SELECT admin FROM user_data WHERE id = auth.uid())
  );

-- Admins can revoke invitations for their firm
CREATE POLICY "invitation_update_admin" ON user_invitation
  FOR UPDATE TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT admin FROM user_data WHERE id = auth.uid())
  );
