-- ============================================================
-- Services cabinet
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE service (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL,
  "group"       TEXT    NOT NULL CHECK ("group" IN ('accounting','tax','social','legal','audit','consulting')),
  frequency     TEXT    NOT NULL CHECK (frequency IN ('monthly','quarterly','annual','punctual')),
  country_codes CHAR(2)[],         -- NULL = tous pays
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  rank          INT     NOT NULL DEFAULT 0
);

CREATE TABLE service_document_type (
  service_id       UUID NOT NULL REFERENCES service(id)       ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES document_type(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, document_type_id)
);

CREATE TABLE customer_service (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID        NOT NULL REFERENCES firm(id)     ON DELETE CASCADE,
  customer_id UUID        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  service_id  UUID        NOT NULL REFERENCES service(id),
  start_date  DATE,
  end_date    DATE,
  comment     TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customer_service_updated_at
  BEFORE UPDATE ON customer_service
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE service              ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_document_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_service     ENABLE ROW LEVEL SECURITY;

-- service : lecture pour tous, écriture master uniquement
CREATE POLICY "service_select" ON service
  FOR SELECT TO authenticated USING (true);

-- service_document_type : lecture pour tous
CREATE POLICY "sdt_select" ON service_document_type
  FOR SELECT TO authenticated USING (true);

-- customer_service : firm users
CREATE POLICY "cs_select_firm" ON customer_service
  FOR SELECT TO authenticated USING (firm_id = my_firm_id());

CREATE POLICY "cs_insert_firm" ON customer_service
  FOR INSERT TO authenticated WITH CHECK (firm_id = my_firm_id());

CREATE POLICY "cs_update_firm" ON customer_service
  FOR UPDATE TO authenticated USING (firm_id = my_firm_id());

CREATE POLICY "cs_delete_firm" ON customer_service
  FOR DELETE TO authenticated USING (firm_id = my_firm_id());

-- customer_service : customer users (consultation uniquement)
CREATE POLICY "cs_select_customer" ON customer_service
  FOR SELECT TO authenticated
  USING (customer_id IN (
    SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
  ));

-- ── Grants ───────────────────────────────────────────────────

GRANT SELECT ON service               TO authenticated;
GRANT SELECT ON service_document_type TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_service TO authenticated;

-- service : master gère via service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON service               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_document_type TO service_role;

-- ── Seed services ────────────────────────────────────────────

INSERT INTO service (name, "group", frequency, country_codes, rank) VALUES

  -- Comptabilité (NULL = tous pays)
  ('Tenue de comptabilité générale',           'accounting', 'monthly',   NULL,            10),
  ('Bilan et états financiers annuels',        'accounting', 'annual',    NULL,            20),
  ('Comptabilité analytique et tableaux de bord','accounting','monthly',  NULL,            30),

  -- Fiscal — multi-pays
  ('Déclaration TVA',                          'tax',        'monthly',   '{FR,TN,MA}',   40),
  ('Déclaration IS et acomptes',               'tax',        'quarterly', '{FR,TN,MA}',   50),
  ('Retenues à la source',                     'tax',        'monthly',   '{TN,MA}',      60),

  -- Fiscal — France
  ('Liasse fiscale IS / IR',                   'tax',        'annual',    '{FR}',         70),
  ('Prélèvement à la source (PAS)',            'tax',        'monthly',   '{FR}',         80),
  ('CFE et contribution économique territoriale','tax',       'quarterly', '{FR}',         90),
  ('DAS2 et taxe d''apprentissage',            'tax',        'annual',    '{FR}',        100),

  -- Fiscal — Tunisie
  ('TCL et droit de timbre',                   'tax',        'quarterly', '{TN}',        110),

  -- Fiscal — Maroc
  ('Taxe professionnelle',                     'tax',        'annual',    '{MA}',        120),

  -- Social (NULL = tous pays)
  ('Établissement des bulletins de paie',      'social',     'monthly',   NULL,          130),
  ('Déclarations sociales et charges patronales','social',   'monthly',   NULL,          140),

  -- Social — Tunisie
  ('TFP et FOPROLOS',                          'social',     'monthly',   '{TN}',        150),

  -- Social — Maroc
  ('CNSS et déclarations sociales',            'social',     'monthly',   '{MA}',        160),

  -- Juridique (NULL = tous pays)
  ('Secrétariat juridique et assemblées',      'legal',      'annual',    NULL,          170),
  ('Création et formalités d''entreprise',     'legal',      'punctual',  NULL,          180),

  -- Audit (NULL = tous pays)
  ('Audit légal / Commissariat aux comptes',   'audit',      'punctual',  NULL,          190),

  -- Conseil (NULL = tous pays)
  ('Conseil fiscal et optimisation',           'consulting', 'punctual',  NULL,          200),
  ('Conseil et accompagnement de direction',   'consulting', 'punctual',  NULL,          210);

-- ── Seed service_document_type ───────────────────────────────

-- Tenue de comptabilité → Balance générale + Grand livre (tous pays)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Tenue de comptabilité générale'
  AND dt.name IN ('Balance générale','Grand livre') AND dt.customer = false;

-- Bilan → Bilan comptable + Compte de résultat (tous pays)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Bilan et états financiers annuels'
  AND dt.name IN ('Bilan comptable','Compte de résultat') AND dt.customer = false;

-- Déclaration TVA → Déclaration TVA (FR, TN, MA)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Déclaration TVA'
  AND dt.name = 'Déclaration TVA' AND dt.customer = false;

-- Déclaration IS et acomptes → IS par pays
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Déclaration IS et acomptes'
  AND dt.name IN ('Déclaration impôt sociétés','Déclaration impôt sociétés (IS)','Déclaration IS')
  AND dt.customer = false;

-- Liasse fiscale → Liasse fiscale (FR)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Liasse fiscale IS / IR'
  AND dt.name = 'Liasse fiscale' AND dt.country_code = 'FR' AND dt.customer = false;

-- Retenues à la source (TN, MA)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Retenues à la source'
  AND dt.name = 'Retenue à la source' AND dt.customer = false;

-- Bulletins de paie → Fiche de paie (tous pays)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Établissement des bulletins de paie'
  AND dt.name = 'Fiche de paie' AND dt.customer = false;

-- Déclarations sociales → Déclaration sociale (FR) + CNSS (TN, MA)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Déclarations sociales et charges patronales'
  AND dt.name IN ('Déclaration sociale','Déclaration CNSS') AND dt.customer = false;

-- CNSS Maroc
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'CNSS et déclarations sociales'
  AND dt.name IN ('Déclaration CNSS','Déclaration CIMR')
  AND dt.country_code = 'MA' AND dt.customer = false;

-- Taxe professionnelle (MA)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'Taxe professionnelle'
  AND dt.name = 'Taxe professionnelle' AND dt.customer = false;

-- CFE et DAS2 → Autre déclaration fiscale (FR)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name IN ('CFE et contribution économique territoriale','DAS2 et taxe d''apprentissage')
  AND dt.name = 'Autre déclaration fiscale' AND dt.country_code = 'FR' AND dt.customer = false;

-- TCL Tunisie → Autre déclaration fiscale (TN)
INSERT INTO service_document_type (service_id, document_type_id)
SELECT s.id, dt.id FROM service s, document_type dt
WHERE s.name = 'TCL et droit de timbre'
  AND dt.name = 'Autre déclaration fiscale' AND dt.country_code = 'TN' AND dt.customer = false;
