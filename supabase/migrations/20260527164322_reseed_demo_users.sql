-- user_data — firm users (admin = true)
INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active) VALUES
  ('d103d7b4-c900-43e5-9a2c-703a1ecfd2b6', '00000010-0000-0000-0000-000000000001', 'firm', 'Cab Demo', 'FR', true, true),
  ('c189bd67-cf0a-4a0e-92aa-ddc2c85175db', '00000010-0000-0000-0000-000000000002', 'firm', 'Cab Demo', 'TN', true, true),
  ('e80c2386-c9a1-4cf5-9fc3-46d8723a6331', '00000010-0000-0000-0000-000000000003', 'firm', 'Cab Demo', 'MA', true, true);

-- user_data — customer users
INSERT INTO user_data (id, firm_id, role, first_name, last_name, admin, active) VALUES
  ('0c621d22-7358-4259-8610-f2ea816c6119', '00000010-0000-0000-0000-000000000001', 'customer', 'Client Demo', 'FR', false, true),
  ('115fe8c1-3564-4105-9532-ed484e8302a0', '00000010-0000-0000-0000-000000000002', 'customer', 'Client Demo', 'TN', false, true),
  ('8095a683-c863-415b-ad85-1efe6a75bdcf', '00000010-0000-0000-0000-000000000003', 'customer', 'Client Demo', 'MA', false, true);

-- user_customer
INSERT INTO user_customer (user_id, customer_id, admin) VALUES
  ('0c621d22-7358-4259-8610-f2ea816c6119', '00000020-0000-0000-0000-000000000001', false),
  ('115fe8c1-3564-4105-9532-ed484e8302a0', '00000020-0000-0000-0000-000000000002', false),
  ('8095a683-c863-415b-ad85-1efe6a75bdcf', '00000020-0000-0000-0000-000000000003', false);
