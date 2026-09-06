-- audit_check_type : référentiel générique des checks d'audit, partagé par tous les cabs
-- Table globale, pas de firm_id — category='fournisseurs' est la seule valeur réellement validée (compte 401),
-- extensible plus tard (ex: 'clients' pour le 411) par un simple ALTER TABLE quand un vrai besoin existe

CREATE TABLE IF NOT EXISTS audit_check_type (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT NOT NULL UNIQUE,
  category                  TEXT NOT NULL CHECK (category IN ('fournisseurs')),
  name                      TEXT NOT NULL,
  description               TEXT,
  question_template         TEXT NOT NULL,
  default_severity          TEXT NOT NULL CHECK (default_severity IN ('low', 'medium', 'high')),
  default_threshold_days    INTEGER,
  default_threshold_amount  NUMERIC,
  active                    BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS audit_check_type_updated_at ON audit_check_type;
CREATE TRIGGER audit_check_type_updated_at
  BEFORE UPDATE ON audit_check_type FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : référentiel global, lecture pour tous les authentifiés, écriture réservée au service_role (pas d'UI cab pour éditer le référentiel en v1)
ALTER TABLE audit_check_type ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON audit_check_type TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_check_type TO service_role;

CREATE POLICY "audit_check_type_select_all" ON audit_check_type
  FOR SELECT TO authenticated USING (true);

-- Référentiel v1 — périmètre comptes fournisseurs uniquement (compte 401 PCG)
-- Les 3 premiers sont codés et testés sur données réelles (AMG Conseil, K SHOP + SCI DEFEZ).
-- facture_manquante est une vraie demande client jamais encore codée : active=false tant que non implémenté,
-- pour ne pas afficher comme fonctionnel ce qui ne l'est pas.
INSERT INTO audit_check_type (code, category, name, description, question_template, default_severity, default_threshold_days, active) VALUES
  ('solde_inverse', 'fournisseurs', 'Solde en sens anormal',
   'Un compte fournisseur (401) est en position débitrice, inhabituelle pour ce type de compte.',
   'à vérifier : le compte {tiers_nom} ({compte_ref}) est en position {sens} de {montant} € — sens inhabituel pour ce type de compte ?',
   'high', NULL, true),
  ('ecriture_non_lettree', 'fournisseurs', 'Écriture ancienne non lettrée',
   'Une ou plusieurs écritures sur un compte fournisseur restent non lettrées au-delà du seuil d''ancienneté.',
   'à vérifier : {nb_lignes} écriture(s) du {date} non lettrée(s) sur {tiers_nom}, ancienneté {anciennete_j} jours',
   'medium', 60, true),
  ('solde_ouvert_ancien', 'fournisseurs', 'Solde ouvert au-delà du seuil',
   'Une facture fournisseur reste ouverte (non soldée) au-delà du seuil d''ancienneté.',
   'à vérifier : facture {facture_ref} de {montant} € toujours ouverte, {anciennete_j} jours',
   'medium', 90, true),
  ('facture_manquante', 'fournisseurs', 'Facture manquante',
   'Un paiement bancaire est constaté sans facture fournisseur correspondante rapprochée.',
   'à vérifier : paiement de {montant} € du {date} sur {tiers_nom} sans facture correspondante — facture manquante ?',
   'high', NULL, false)
ON CONFLICT (code) DO NOTHING;
