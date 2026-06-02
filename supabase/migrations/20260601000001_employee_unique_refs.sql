-- Unicité identity_ref et social_ref par client (customer_id)
-- Index partiels : NULL n'entre pas en conflit (plusieurs salariés sans CIN/CNSS = OK)

CREATE UNIQUE INDEX IF NOT EXISTS uidx_employee_identity
  ON customer_employee (customer_id, identity_ref)
  WHERE identity_ref IS NOT NULL AND identity_ref <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_employee_social
  ON customer_employee (customer_id, social_ref)
  WHERE social_ref IS NOT NULL AND social_ref <> '';
