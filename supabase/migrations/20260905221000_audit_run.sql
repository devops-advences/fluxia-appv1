-- audit_run : une exécution de l'audit comptes fournisseurs pour un dossier client, sur une période donnée
-- Le calcul (appel ERP + checks) se fait dans n8n ; cette table est le stockage du résultat côté FluxIA.
-- Le run précédent n'est pas stocké par pointeur : il se retrouve par requête (customer_id, created_at DESC).
-- Le stockage du rapport (Word édité par le collaborateur) reste un point ouvert, pas de colonne pour l'instant.

CREATE TABLE IF NOT EXISTS audit_run (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                   UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  customer_id               UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  period_start              DATE NOT NULL,
  period_end                DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'running', 'success', 'failed', 'unchanged')),
  source_last_activity_at   TIMESTAMPTZ,
  triggered_by              UUID REFERENCES user_data(id) ON DELETE SET NULL,
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sert à retrouver "le run précédent d'un dossier" par requête (ORDER BY created_at DESC LIMIT 1),
-- au lieu d'un pointeur previous_run_id stocké.
CREATE INDEX audit_run_customer_created ON audit_run(customer_id, created_at DESC);

DROP TRIGGER IF EXISTS audit_run_updated_at ON audit_run;
CREATE TRIGGER audit_run_updated_at
  BEFORE UPDATE ON audit_run FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : le cabinet voit les runs de son propre firm. Le client final n'a pas accès à cette table
-- (le mode de livraison du rapport au client reste un point ouvert, hors Fluxia pour l'instant).
-- Les écritures viennent de n8n/service_role, pas d'insertion/modification côté app en v1.
ALTER TABLE audit_run ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON audit_run TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_run TO service_role;

CREATE POLICY "audit_run_select_firm" ON audit_run
  FOR SELECT TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (SELECT role FROM user_data WHERE id = auth.uid()) = 'firm'
  );
