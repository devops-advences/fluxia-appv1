-- Remplace inbox_read + inbox_flag par user_inbox

DROP TABLE IF EXISTS inbox_read;
DROP TABLE IF EXISTS inbox_flag;

CREATE TABLE user_inbox (
  inbox_event_id UUID        NOT NULL REFERENCES firm_inbox(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  read_at        TIMESTAMPTZ,
  flagged        BOOLEAN     NOT NULL DEFAULT false,
  deleted_at     TIMESTAMPTZ,
  PRIMARY KEY (inbox_event_id, user_id)
);

ALTER TABLE user_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_inbox_select" ON user_inbox FOR SELECT    TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_inbox_insert" ON user_inbox FOR INSERT    TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_inbox_update" ON user_inbox FOR UPDATE    TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_inbox_delete" ON user_inbox FOR DELETE    TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_inbox TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_inbox TO service_role;
