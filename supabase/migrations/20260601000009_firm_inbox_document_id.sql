-- Ajoute document_id sur firm_inbox pour les events liés à un document

ALTER TABLE firm_inbox
  ADD COLUMN document_id UUID REFERENCES document(id) ON DELETE SET NULL;

CREATE INDEX firm_inbox_document_id ON firm_inbox(document_id) WHERE document_id IS NOT NULL;

-- Met à jour fill_firm_inbox avec document_id

CREATE OR REPLACE FUNCTION fill_firm_inbox()
RETURNS VOID AS $$
BEGIN

  -- 1. Messages reçus de clients
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, document_id, payload, event_at)
  SELECT
    m.firm_id,
    'message',
    'message',
    m.id,
    m.customer_id,
    CASE WHEN m.object_type = 'document' THEN m.object_id ELSE NULL END,
    jsonb_build_object(
      'body_preview',   LEFT(m.body, 120),
      'customer_name',  c.name,
      'object_type',    m.object_type,
      'sender_name',    ud.first_name || ' ' || ud.last_name
    ),
    m.created_at
  FROM message m
  JOIN customer  c  ON c.id  = m.customer_id
  JOIN user_data ud ON ud.id = m.sender_id AND ud.role = 'customer'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE
    SET document_id = EXCLUDED.document_id;

  -- 2. Documents déposés par clients
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, document_id, payload, event_at)
  SELECT
    d.firm_id, 'document_uploaded', 'document_event', de.id, d.customer_id, d.id,
    jsonb_build_object('filename', COALESCE(d.filename,'Document sans nom'), 'customer_name', c.name, 'doc_type', COALESCE(dt.name,'')),
    de.created_at
  FROM document_event de
  JOIN document d ON d.id = de.document_id
  JOIN customer c ON c.id = d.customer_id
  LEFT JOIN document_type dt ON dt.id = d.type_id
  WHERE de.event_type = 'uploaded' AND d.source = 'customer'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE SET document_id = EXCLUDED.document_id;

  -- 3. Livrables déposés par le cabinet
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, document_id, payload, event_at)
  SELECT
    d.firm_id, 'livrable_uploaded', 'livrable_event', de.id, d.customer_id, d.id,
    jsonb_build_object('filename', COALESCE(d.filename,'Livrable sans nom'), 'customer_name', c.name, 'doc_type', COALESCE(dt.name,'')),
    de.created_at
  FROM document_event de
  JOIN document d ON d.id = de.document_id
  JOIN customer c ON c.id = d.customer_id
  LEFT JOIN document_type dt ON dt.id = d.type_id
  WHERE de.event_type = 'uploaded' AND d.source = 'firm'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE SET document_id = EXCLUDED.document_id;

  -- 4. Changements de statut documents
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, document_id, payload, event_at)
  SELECT
    d.firm_id, 'document_status', 'document_event_status', de.id, d.customer_id, d.id,
    jsonb_build_object('filename', COALESCE(d.filename,'Document sans nom'), 'customer_name', c.name, 'new_status', de.new_status, 'old_status', de.old_status),
    de.created_at
  FROM document_event de
  JOIN document d ON d.id = de.document_id
  JOIN customer c ON c.id = d.customer_id
  WHERE de.event_type = 'status_changed'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE SET document_id = EXCLUDED.document_id;

  -- 5. Tâches en retard
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    rts.firm_id, 'task_late', 'recurring_task_status', rts.id, rts.customer_id,
    jsonb_build_object('task_name', rt.name, 'customer_name', c.name, 'month', rts.month, 'year', rts.year),
    COALESCE(rts.updated_at, rts.created_at)
  FROM recurring_task_status rts
  JOIN recurring_task rt ON rt.id = rts.recurring_task_id
  JOIN customer c ON c.id = rts.customer_id
  WHERE rts.status = 'late'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE
    SET payload = EXCLUDED.payload, event_at = EXCLUDED.event_at;

  -- 6. Clients créés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT c.firm_id, 'customer_created', 'customer', c.id, c.id,
    jsonb_build_object('customer_name', c.name), c.created_at
  FROM customer c
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 7. Services créés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT cs.firm_id, 'service_added', 'customer_service', cs.id, cs.customer_id,
    jsonb_build_object('service_name', s.name, 'customer_name', c.name), cs.created_at
  FROM customer_service cs
  JOIN service s ON s.id = cs.service_id
  JOIN customer c ON c.id = cs.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 8. Salariés créés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT ce.firm_id, 'employee_added', 'customer_employee', ce.id, ce.customer_id,
    jsonb_build_object('employee_name', ce.first_name || ' ' || ce.last_name, 'customer_name', c.name), ce.created_at
  FROM customer_employee ce
  JOIN customer c ON c.id = ce.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 9. Comptes bancaires créés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT cba.firm_id, 'account_added', 'customer_bank_account', cba.id, cba.customer_id,
    jsonb_build_object('bank_name', b.name, 'customer_name', c.name), cba.created_at
  FROM customer_bank_account cba
  JOIN bank b ON b.id = cba.bank_id
  JOIN customer c ON c.id = cba.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Repopulation pour remplir document_id sur l'existant
SELECT fill_firm_inbox();
