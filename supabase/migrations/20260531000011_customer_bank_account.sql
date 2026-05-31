-- ============================================================
-- Comptes bancaires clients
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE bank (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  country_code CHAR(2) NOT NULL,
  logo_url     TEXT,
  firm_id      UUID    REFERENCES firm(id) ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT true,
  rank         INT     NOT NULL DEFAULT 0
  -- firm_id NULL  → banque globale (seed)
  -- firm_id non-NULL → banque custom ajoutée par un cabinet
);

CREATE TABLE customer_bank_account (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID        NOT NULL REFERENCES firm(id)     ON DELETE CASCADE,
  customer_id   UUID        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  bank_id       UUID        NOT NULL REFERENCES bank(id),
  type          TEXT        NOT NULL CHECK (type IN ('current','savings','term','foreign')),
  name          TEXT,
  iban          TEXT,
  bic           TEXT,
  currency_code CHAR(3)     NOT NULL DEFAULT 'EUR',
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customer_bank_account_updated_at
  BEFORE UPDATE ON customer_bank_account
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE bank                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_bank_account ENABLE ROW LEVEL SECURITY;

-- bank : lecture pour tous les authentifiés (banques globales + custom du cabinet)
CREATE POLICY "bank_select" ON bank
  FOR SELECT TO authenticated
  USING (firm_id IS NULL OR firm_id = my_firm_id());

-- bank : insertion de banques custom par les users du cabinet
CREATE POLICY "bank_insert_firm" ON bank
  FOR INSERT TO authenticated
  WITH CHECK (firm_id = my_firm_id());

-- bank : modification/suppression des banques custom du cabinet uniquement
CREATE POLICY "bank_update_firm" ON bank
  FOR UPDATE TO authenticated
  USING (firm_id = my_firm_id());

CREATE POLICY "bank_delete_firm" ON bank
  FOR DELETE TO authenticated
  USING (firm_id = my_firm_id());

-- customer_bank_account : firm users voient tous les comptes de leur firm
CREATE POLICY "cba_select_firm" ON customer_bank_account
  FOR SELECT TO authenticated
  USING (firm_id = my_firm_id());

-- customer_bank_account : customer users voient leurs propres comptes
CREATE POLICY "cba_select_customer" ON customer_bank_account
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

-- customer_bank_account : firm users gèrent tous les comptes de leur firm
CREATE POLICY "cba_insert_firm" ON customer_bank_account
  FOR INSERT TO authenticated
  WITH CHECK (firm_id = my_firm_id());

CREATE POLICY "cba_update_firm" ON customer_bank_account
  FOR UPDATE TO authenticated
  USING (firm_id = my_firm_id());

CREATE POLICY "cba_delete_firm" ON customer_bank_account
  FOR DELETE TO authenticated
  USING (firm_id = my_firm_id());

-- customer_bank_account : customer users gèrent leurs propres comptes
CREATE POLICY "cba_insert_customer" ON customer_bank_account
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cba_update_customer" ON customer_bank_account
  FOR UPDATE TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cba_delete_customer" ON customer_bank_account
  FOR DELETE TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customer WHERE user_id = auth.uid()
    )
  );

-- ── Grants ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON bank                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_bank_account TO authenticated;

-- ── Seed banques globales ────────────────────────────────────

INSERT INTO bank (name, country_code, rank) VALUES

  -- France
  ('BNP Paribas',          'FR', 10),
  ('Société Générale',     'FR', 20),
  ('Crédit Agricole',      'FR', 30),
  ('LCL',                  'FR', 40),
  ('Caisse d''Épargne',    'FR', 50),
  ('Banque Populaire',     'FR', 60),
  ('CIC',                  'FR', 70),
  ('Crédit Mutuel',        'FR', 80),
  ('La Banque Postale',    'FR', 90),
  ('HSBC France',          'FR', 100),
  ('Natixis',              'FR', 110),
  ('Bred',                 'FR', 120),
  ('Boursorama',           'FR', 130),
  ('Hello Bank',           'FR', 140),
  ('Fortuneo',             'FR', 150),
  ('BforBank',             'FR', 160),
  ('Monabanq',             'FR', 170),
  ('ING France',           'FR', 180),
  ('AXA Banque',           'FR', 190),
  ('Orange Bank',          'FR', 200),
  ('Milleis Banque',       'FR', 210),
  ('Nickel',               'FR', 220),
  ('Qonto',                'FR', 230),
  ('Shine',                'FR', 240),
  ('N26',                  'FR', 250),
  ('Revolut Business',     'FR', 260),
  ('Memo Bank',            'FR', 270),
  ('Blank',                'FR', 280),
  ('Anytime',              'FR', 290),
  ('Banque Transatlantique','FR', 300),

  -- Tunisie
  ('BIAT',                 'TN', 10),
  ('STB',                  'TN', 20),
  ('BNA',                  'TN', 30),
  ('BH Bank',              'TN', 40),
  ('UIB',                  'TN', 50),
  ('Amen Bank',            'TN', 60),
  ('Attijari Bank',        'TN', 70),
  ('UBCI',                 'TN', 80),
  ('ATB',                  'TN', 90),
  ('BTK',                  'TN', 100),
  ('BT',                   'TN', 110),
  ('BTE',                  'TN', 120),
  ('BFT',                  'TN', 130),
  ('BTS',                  'TN', 140),
  ('BTL',                  'TN', 150),
  ('TSB',                  'TN', 160),
  ('TIB',                  'TN', 170),
  ('NAIB',                 'TN', 180),
  ('ABC Tunisie',          'TN', 190),
  ('Citibank Tunisie',     'TN', 200),
  ('QNB Tunisia',          'TN', 210),
  ('Zitouna Bank',         'TN', 220),
  ('Wifak International Bank', 'TN', 230),
  ('Al Baraka Bank',       'TN', 240),

  -- Maroc
  ('Attijariwafa Bank',    'MA', 10),
  ('Banque Centrale Populaire', 'MA', 20),
  ('Bank of Africa (BMCE)','MA', 30),
  ('CIH Bank',             'MA', 40),
  ('Société Générale Maroc','MA', 50),
  ('BMCI',                 'MA', 60),
  ('Al Barid Bank',        'MA', 70),
  ('Crédit du Maroc',      'MA', 80),
  ('CFG Bank',             'MA', 90),
  ('Crédit Agricole du Maroc', 'MA', 100),
  ('Arab Bank Maroc',      'MA', 110),
  ('Citibank Maroc',       'MA', 120),
  ('Bank Al-Amal',         'MA', 130),
  ('Umnia Bank',           'MA', 140),
  ('Al Akhdar Bank',       'MA', 150),
  ('Bank Al Yousr',        'MA', 160),
  ('BTI Bank',             'MA', 170),
  ('Bank Assafa',          'MA', 180);
