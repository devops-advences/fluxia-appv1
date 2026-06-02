-- RLS — données de référence, lecture pour tous les users authentifiés
ALTER TABLE fiscal_deadline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_deadline_read" ON fiscal_deadline FOR SELECT TO authenticated USING (true);

-- ================================================================
-- Seed fiscal_deadline 2026 — FR, TN, MA
-- IS déclarations annuelles pour FY2025 incluses (dues en 2026)
-- year = année de la période fiscale (period_start)
-- ================================================================


-- ------
-- FRANCE
-- ------

-- TVA mensuelle — déclarations (CA3)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 janvier 2026',    '2026-01-01', '2026-01-31', '2026-02-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 février 2026',    '2026-02-01', '2026-02-28', '2026-03-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 mars 2026',       '2026-03-01', '2026-03-31', '2026-04-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 avril 2026',      '2026-04-01', '2026-04-30', '2026-05-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 mai 2026',        '2026-05-01', '2026-05-31', '2026-06-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 juin 2026',       '2026-06-01', '2026-06-30', '2026-07-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 juillet 2026',    '2026-07-01', '2026-07-31', '2026-08-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 août 2026',       '2026-08-01', '2026-08-31', '2026-09-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 septembre 2026',  '2026-09-01', '2026-09-30', '2026-10-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 octobre 2026',    '2026-10-01', '2026-10-31', '2026-11-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 novembre 2026',   '2026-11-01', '2026-11-30', '2026-12-19'),
  ('FR', 2026, 'value_added_tax', 'declaration', 'CA3 décembre 2026',   '2026-12-01', '2026-12-31', '2027-01-19');

-- TVA mensuelle — paiements
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA janvier 2026',    '2026-01-01', '2026-01-31', '2026-02-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA février 2026',    '2026-02-01', '2026-02-28', '2026-03-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA mars 2026',       '2026-03-01', '2026-03-31', '2026-04-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA avril 2026',      '2026-04-01', '2026-04-30', '2026-05-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA mai 2026',        '2026-05-01', '2026-05-31', '2026-06-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA juin 2026',       '2026-06-01', '2026-06-30', '2026-07-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA juillet 2026',    '2026-07-01', '2026-07-31', '2026-08-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA août 2026',       '2026-08-01', '2026-08-31', '2026-09-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA septembre 2026',  '2026-09-01', '2026-09-30', '2026-10-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA octobre 2026',    '2026-10-01', '2026-10-31', '2026-11-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA novembre 2026',   '2026-11-01', '2026-11-30', '2026-12-19'),
  ('FR', 2026, 'value_added_tax', 'payment', 'Paiement TVA décembre 2026',   '2026-12-01', '2026-12-31', '2027-01-19');

-- IS acomptes — 4 trimestres
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('FR', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T1 2026', '2026-01-01', '2026-03-31', '2026-03-15'),
  ('FR', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T2 2026', '2026-04-01', '2026-06-30', '2026-06-15'),
  ('FR', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T3 2026', '2026-07-01', '2026-09-30', '2026-09-15'),
  ('FR', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T4 2026', '2026-10-01', '2026-12-31', '2026-12-15');

-- IS déclaration annuelle FY2025 (liasse fiscale)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('FR', 2025, 'corporate_income_tax', 'declaration', 'Liasse fiscale 2025', '2025-01-01', '2025-12-31', '2026-05-15');


-- --------
-- TUNISIE
-- --------

-- TVA mensuelle — déclarations
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA janvier 2026',    '2026-01-01', '2026-01-31', '2026-02-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA février 2026',    '2026-02-01', '2026-02-28', '2026-03-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA mars 2026',       '2026-03-01', '2026-03-31', '2026-04-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA avril 2026',      '2026-04-01', '2026-04-30', '2026-05-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA mai 2026',        '2026-05-01', '2026-05-31', '2026-06-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA juin 2026',       '2026-06-01', '2026-06-30', '2026-07-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA juillet 2026',    '2026-07-01', '2026-07-31', '2026-08-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA août 2026',       '2026-08-01', '2026-08-31', '2026-09-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA septembre 2026',  '2026-09-01', '2026-09-30', '2026-10-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA octobre 2026',    '2026-10-01', '2026-10-31', '2026-11-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA novembre 2026',   '2026-11-01', '2026-11-30', '2026-12-28'),
  ('TN', 2026, 'value_added_tax', 'declaration', 'TVA décembre 2026',   '2026-12-01', '2026-12-31', '2027-01-28');

-- TVA mensuelle — paiements
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA janvier 2026',    '2026-01-01', '2026-01-31', '2026-02-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA février 2026',    '2026-02-01', '2026-02-28', '2026-03-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA mars 2026',       '2026-03-01', '2026-03-31', '2026-04-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA avril 2026',      '2026-04-01', '2026-04-30', '2026-05-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA mai 2026',        '2026-05-01', '2026-05-31', '2026-06-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA juin 2026',       '2026-06-01', '2026-06-30', '2026-07-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA juillet 2026',    '2026-07-01', '2026-07-31', '2026-08-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA août 2026',       '2026-08-01', '2026-08-31', '2026-09-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA septembre 2026',  '2026-09-01', '2026-09-30', '2026-10-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA octobre 2026',    '2026-10-01', '2026-10-31', '2026-11-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA novembre 2026',   '2026-11-01', '2026-11-30', '2026-12-28'),
  ('TN', 2026, 'value_added_tax', 'payment', 'Paiement TVA décembre 2026',   '2026-12-01', '2026-12-31', '2027-01-28');

-- IS acomptes — 3 (juin / sep / déc)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('TN', 2026, 'corporate_income_tax', 'installment', 'Acompte IS 1 2026', '2026-01-01', '2026-06-30', '2026-06-28'),
  ('TN', 2026, 'corporate_income_tax', 'installment', 'Acompte IS 2 2026', '2026-07-01', '2026-09-30', '2026-09-28'),
  ('TN', 2026, 'corporate_income_tax', 'installment', 'Acompte IS 3 2026', '2026-10-01', '2026-12-31', '2026-12-28');

-- IS déclaration annuelle FY2025
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('TN', 2025, 'corporate_income_tax', 'declaration', 'IS annuel 2025', '2025-01-01', '2025-12-31', '2026-03-25');


-- ------
-- MAROC
-- ------

-- TVA mensuelle — déclarations
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA janvier 2026',    '2026-01-01', '2026-01-31', '2026-02-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA février 2026',    '2026-02-01', '2026-02-28', '2026-03-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA mars 2026',       '2026-03-01', '2026-03-31', '2026-04-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA avril 2026',      '2026-04-01', '2026-04-30', '2026-05-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA mai 2026',        '2026-05-01', '2026-05-31', '2026-06-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA juin 2026',       '2026-06-01', '2026-06-30', '2026-07-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA juillet 2026',    '2026-07-01', '2026-07-31', '2026-08-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA août 2026',       '2026-08-01', '2026-08-31', '2026-09-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA septembre 2026',  '2026-09-01', '2026-09-30', '2026-10-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA octobre 2026',    '2026-10-01', '2026-10-31', '2026-11-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA novembre 2026',   '2026-11-01', '2026-11-30', '2026-12-20'),
  ('MA', 2026, 'value_added_tax', 'declaration', 'TVA décembre 2026',   '2026-12-01', '2026-12-31', '2027-01-20');

-- IS acomptes — 4 trimestres (dernier jour du trimestre)
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('MA', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T1 2026', '2026-01-01', '2026-03-31', '2026-03-31'),
  ('MA', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T2 2026', '2026-04-01', '2026-06-30', '2026-06-30'),
  ('MA', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T3 2026', '2026-07-01', '2026-09-30', '2026-09-30'),
  ('MA', 2026, 'corporate_income_tax', 'installment', 'Acompte IS T4 2026', '2026-10-01', '2026-12-31', '2026-12-31');

-- IS déclaration annuelle FY2025
INSERT INTO fiscal_deadline (country_code, year, tax_type, event_type, label, period_start, period_end, due_date) VALUES
  ('MA', 2025, 'corporate_income_tax', 'declaration', 'IS annuel 2025', '2025-01-01', '2025-12-31', '2026-03-31');
