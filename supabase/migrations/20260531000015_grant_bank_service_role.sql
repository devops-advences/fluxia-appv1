-- service_role doit pouvoir lire et mettre à jour bank (logo_url, seed script)
GRANT SELECT, UPDATE ON bank TO service_role;
