-- Full reseed: firm → customer → user_data → user_customer
-- Safe to re-run (ON CONFLICT DO NOTHING)

INSERT INTO firm (id, name, slug, country_code, active) VALUES
  ('00000010-0000-0000-0000-000000000001', 'Cab Demo FR', 'cab-demo-fr', 'FR', true),
  ('00000010-0000-0000-0000-000000000002', 'Cab Demo TN', 'cab-demo-tn', 'TN', true),
  ('00000010-0000-0000-0000-000000000003', 'Cab Demo MA', 'cab-demo-ma', 'MA', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer (id, firm_id, name, country_code, legal_entity, active) VALUES
  ('00000020-0000-0000-0000-000000000001', '00000010-0000-0000-0000-000000000001', 'Client Demo FR', 'FR', true, true),
  ('00000020-0000-0000-0000-000000000002', '00000010-0000-0000-0000-000000000002', 'Client Demo TN', 'TN', true, true),
  ('00000020-0000-0000-0000-000000000003', '00000010-0000-0000-0000-000000000003', 'Client Demo MA', 'MA', true, true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM user_customer;
DELETE FROM user_data;

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000001'::UUID, 'firm', 'Cab Demo', 'FR', true, true
FROM auth.users au WHERE au.email = 'cab-demo-fr@fluxia-app.com';

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000002'::UUID, 'firm', 'Cab Demo', 'TN', true, true
FROM auth.users au WHERE au.email = 'cab-demo-tn@fluxia-app.com';

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000003'::UUID, 'firm', 'Cab Demo', 'MA', true, true
FROM auth.users au WHERE au.email = 'cab-demo-ma@fluxia-app.com';

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000001'::UUID, 'customer', 'Client Demo', 'FR', false, true
FROM auth.users au WHERE au.email = 'client-demo-fr@fluxia-app.com';

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000002'::UUID, 'customer', 'Client Demo', 'TN', false, true
FROM auth.users au WHERE au.email = 'client-demo-tn@fluxia-app.com';

INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active)
SELECT au.id, '00000010-0000-0000-0000-000000000003'::UUID, 'customer', 'Client Demo', 'MA', false, true
FROM auth.users au WHERE au.email = 'client-demo-ma@fluxia-app.com';

INSERT INTO user_customer (user_id, customer_id, admin)
SELECT ud.id, '00000020-0000-0000-0000-000000000001'::UUID, false
FROM user_data ud WHERE ud.role = 'customer' AND ud.firm_id = '00000010-0000-0000-0000-000000000001'::UUID;

INSERT INTO user_customer (user_id, customer_id, admin)
SELECT ud.id, '00000020-0000-0000-0000-000000000002'::UUID, false
FROM user_data ud WHERE ud.role = 'customer' AND ud.firm_id = '00000010-0000-0000-0000-000000000002'::UUID;

INSERT INTO user_customer (user_id, customer_id, admin)
SELECT ud.id, '00000020-0000-0000-0000-000000000003'::UUID, false
FROM user_data ud WHERE ud.role = 'customer' AND ud.firm_id = '00000010-0000-0000-0000-000000000003'::UUID;
