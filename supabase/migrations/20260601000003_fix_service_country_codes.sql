-- Déclaration TVA et IS existent dans tous les pays → country_codes = NULL
UPDATE service SET country_codes = NULL WHERE name IN (
  'Déclaration TVA',
  'Déclaration IS et acomptes'
);
