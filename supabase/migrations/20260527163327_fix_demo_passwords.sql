UPDATE auth.users
SET encrypted_password = '$2b$10$E7pbjaXxvlJAtVbAGhpcf.PjmgK9rmrdxc.x2A4M0GIMuL6VHh86O'
WHERE email IN (
  'cab-demo-fr@fluxia-app.com',
  'cab-demo-tn@fluxia-app.com',
  'cab-demo-ma@fluxia-app.com',
  'client-demo-fr@fluxia-app.com',
  'client-demo-tn@fluxia-app.com',
  'client-demo-ma@fluxia-app.com'
);
