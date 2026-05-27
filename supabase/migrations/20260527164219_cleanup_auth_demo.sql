-- Nettoyer toutes les traces des users demo dans auth
DELETE FROM auth.identities WHERE email IN (
  'cab-demo-fr@fluxia-app.com',
  'cab-demo-tn@fluxia-app.com',
  'cab-demo-ma@fluxia-app.com',
  'client-demo-fr@fluxia-app.com',
  'client-demo-tn@fluxia-app.com',
  'client-demo-ma@fluxia-app.com'
);

DELETE FROM auth.users WHERE email IN (
  'cab-demo-fr@fluxia-app.com',
  'cab-demo-tn@fluxia-app.com',
  'cab-demo-ma@fluxia-app.com',
  'client-demo-fr@fluxia-app.com',
  'client-demo-tn@fluxia-app.com',
  'client-demo-ma@fluxia-app.com'
);

-- Nettoyer user_data liés
DELETE FROM user_customer WHERE user_id IN (
  '00000002-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  '00000002-0000-0000-0000-000000000003'
);
DELETE FROM user_data WHERE firm_id IN (
  '00000010-0000-0000-0000-000000000001',
  '00000010-0000-0000-0000-000000000002',
  '00000010-0000-0000-0000-000000000003'
);
