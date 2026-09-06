-- audit_finding : une anomalie détectée, persistante à travers les runs (pas une ligne par run).
-- Clé naturelle (customer_id, check_type_id, object_ref) : un run qui redétecte la même anomalie
-- met à jour la ligne existante (last_seen_run_id), n'en recrée pas une nouvelle.

CREATE TABLE IF NOT EXISTS audit_finding (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id            UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  customer_id        UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  check_type_id      UUID NOT NULL REFERENCES audit_check_type(id) ON DELETE RESTRICT,
  object_type        TEXT NOT NULL,
  object_ref         TEXT NOT NULL,
  object_name        TEXT,
  message            TEXT NOT NULL,
  severity           TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  detail_lines       JSONB NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  first_seen_run_id  UUID NOT NULL REFERENCES audit_run(id) ON DELETE RESTRICT,
  last_seen_run_id   UUID NOT NULL REFERENCES audit_run(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, check_type_id, object_ref)
);

CREATE INDEX audit_finding_firm ON audit_finding(firm_id);
CREATE INDEX audit_finding_last_seen ON audit_finding(last_seen_run_id);

DROP TRIGGER IF EXISTS audit_finding_updated_at ON audit_finding;
CREATE TRIGGER audit_finding_updated_at
  BEFORE UPDATE ON audit_finding FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : le cabinet voit les findings de son propre firm. Pas d'accès client direct en v1
-- (même raison que audit_run : le mode de livraison au client reste un point ouvert).
ALTER TABLE audit_finding ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON audit_finding TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_finding TO service_role;

CREATE POLICY "audit_finding_select_firm" ON audit_finding
  FOR SELECT TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  );

-- Le collaborateur peut ignorer/rouvrir un finding (jamais le passer à "resolved" manuellement,
-- ce statut est exclusivement automatique — cf. audit_finding_event pour la traçabilité de l'action).
CREATE POLICY "audit_finding_update_firm" ON audit_finding
  FOR UPDATE TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  )
  WITH CHECK (
    firm_id = my_firm_id()
    AND status IN ('open', 'ignored')
  );
