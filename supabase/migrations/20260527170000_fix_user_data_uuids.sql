-- Re-sync user_data with actual auth.users UUIDs (join by email)
-- Safe to re-run: clears and rebuilds from auth.users ground truth

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
