-- customer.external_ref : identifiant du dossier côté ERP (ex: company_id Pennylane), pour la synchro automatique
-- des dossiers d'un cabinet (ex: 1116 dossiers AMG) sans création manuelle un par un.
-- Unique par firm (deux cabs sur des ERP différents peuvent avoir des ids qui se recoupent par hasard).

ALTER TABLE customer
  ADD COLUMN external_ref TEXT;

CREATE UNIQUE INDEX customer_firm_external_ref ON customer(firm_id, external_ref) WHERE external_ref IS NOT NULL;
