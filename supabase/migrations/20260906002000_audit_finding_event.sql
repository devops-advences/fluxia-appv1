-- audit_finding_event : historique des actions manuelles sur un finding (ignorer / rouvrir).
-- La résolution automatique n'est PAS loggée ici : elle se déduit de last_seen_run_id qui n'avance plus
-- (cf. audit_finding), pas besoin de dupliquer cette info dans un event.

CREATE TABLE IF NOT EXISTS audit_finding_event (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id  UUID NOT NULL REFERENCES audit_finding(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES user_data(id) ON DELETE RESTRICT,
  event_type  TEXT NOT NULL CHECK (event_type IN ('ignored', 'reopened')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comment_required_when_ignored CHECK (event_type != 'ignored' OR comment IS NOT NULL)
);

CREATE INDEX audit_finding_event_finding ON audit_finding_event(finding_id, created_at DESC);

-- RLS : le cabinet voit et crée les events de ses propres findings (jamais au nom d'un autre user).
ALTER TABLE audit_finding_event ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON audit_finding_event TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_finding_event TO service_role;

CREATE POLICY "audit_finding_event_select_firm" ON audit_finding_event
  FOR SELECT TO authenticated
  USING (
    finding_id IN (SELECT id FROM audit_finding WHERE firm_id = my_firm_id())
  );

CREATE POLICY "audit_finding_event_insert_firm" ON audit_finding_event
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND finding_id IN (SELECT id FROM audit_finding WHERE firm_id = my_firm_id())
  );
