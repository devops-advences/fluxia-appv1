-- ============================================================
-- Inbox cabinet
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE firm_inbox (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID        NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  source_type TEXT        NOT NULL,
  source_id   UUID        NOT NULL,
  customer_id UUID        REFERENCES customer(id) ON DELETE CASCADE,
  payload     JSONB       NOT NULL DEFAULT '{}',
  event_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (firm_id, source_type, source_id)
);

CREATE INDEX firm_inbox_firm_event   ON firm_inbox(firm_id, event_at DESC);
CREATE INDEX firm_inbox_customer     ON firm_inbox(customer_id);

CREATE TABLE inbox_read (
  inbox_event_id UUID NOT NULL REFERENCES firm_inbox(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inbox_event_id, user_id)
);

CREATE TABLE inbox_flag (
  inbox_event_id UUID NOT NULL REFERENCES firm_inbox(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inbox_event_id, user_id)
);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE firm_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_flag ENABLE ROW LEVEL SECURITY;

-- firm_inbox : lecture uniquement (service_role écrit)
-- admin → tout le cabinet | collaborateur → ses dossiers
CREATE POLICY "firm_inbox_select" ON firm_inbox
  FOR SELECT TO authenticated
  USING (
    firm_id = my_firm_id()
    AND (
      (SELECT admin FROM user_data WHERE id = auth.uid()) = true
      OR customer_id IS NULL
      OR customer_id IN (SELECT customer_id FROM user_customer WHERE user_id = auth.uid())
    )
  );

-- inbox_read : par user
CREATE POLICY "inbox_read_select" ON inbox_read FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "inbox_read_insert" ON inbox_read FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "inbox_read_delete" ON inbox_read FOR DELETE TO authenticated USING (user_id = auth.uid());

-- inbox_flag : par user
CREATE POLICY "inbox_flag_select" ON inbox_flag FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "inbox_flag_insert" ON inbox_flag FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "inbox_flag_delete" ON inbox_flag FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Grants ───────────────────────────────────────────────────

GRANT SELECT                       ON firm_inbox  TO authenticated;
GRANT SELECT, INSERT, DELETE       ON inbox_read  TO authenticated;
GRANT SELECT, INSERT, DELETE       ON inbox_flag  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON firm_inbox TO service_role;

-- ── fill_firm_inbox ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION fill_firm_inbox()
RETURNS VOID AS $$
BEGIN

  -- 1. Messages reçus de clients
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    m.firm_id,
    'message',
    'message',
    m.id,
    m.customer_id,
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
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 2. Documents déposés par clients
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    d.firm_id,
    'document_uploaded',
    'document_event',
    de.id,
    d.customer_id,
    jsonb_build_object(
      'filename',      COALESCE(d.filename, 'Document sans nom'),
      'customer_name', c.name,
      'doc_type',      COALESCE(dt.name, '')
    ),
    de.created_at
  FROM document_event de
  JOIN document      d  ON d.id  = de.document_id
  JOIN customer      c  ON c.id  = d.customer_id
  LEFT JOIN document_type dt ON dt.id = d.type_id
  WHERE de.event_type = 'uploaded' AND d.source = 'customer'
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 3. Changements de statut documents
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    d.firm_id,
    'document_status',
    'document_event_status',
    de.id,
    d.customer_id,
    jsonb_build_object(
      'filename',      COALESCE(d.filename, 'Document sans nom'),
      'customer_name', c.name,
      'new_status',    de.new_status,
      'old_status',    de.old_status
    ),
    de.created_at
  FROM document_event de
  JOIN document  d ON d.id = de.document_id
  JOIN customer  c ON c.id = d.customer_id
  WHERE de.event_type = 'status_changed'
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 4. Tâches en retard (UPSERT : le statut peut changer)
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    rts.firm_id,
    'task_late',
    'recurring_task_status',
    rts.id,
    rts.customer_id,
    jsonb_build_object(
      'task_name',     rt.name,
      'customer_name', c.name,
      'month',         rts.month,
      'year',          rts.year
    ),
    COALESCE(rts.updated_at, rts.created_at)
  FROM recurring_task_status rts
  JOIN recurring_task rt ON rt.id = rts.recurring_task_id
  JOIN customer       c  ON c.id  = rts.customer_id
  WHERE rts.status = 'late'
  ON CONFLICT (firm_id, source_type, source_id) DO UPDATE
    SET payload  = EXCLUDED.payload,
        event_at = EXCLUDED.event_at;

  -- 5. Nouveaux clients
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    c.firm_id,
    'customer_created',
    'customer',
    c.id,
    c.id,
    jsonb_build_object('customer_name', c.name),
    c.created_at
  FROM customer c
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 6. Services ajoutés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    cs.firm_id,
    'service_added',
    'customer_service',
    cs.id,
    cs.customer_id,
    jsonb_build_object(
      'service_name',  s.name,
      'customer_name', c.name
    ),
    cs.created_at
  FROM customer_service cs
  JOIN service  s ON s.id = cs.service_id
  JOIN customer c ON c.id = cs.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 7. Salariés ajoutés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    ce.firm_id,
    'employee_added',
    'customer_employee',
    ce.id,
    ce.customer_id,
    jsonb_build_object(
      'employee_name', ce.first_name || ' ' || ce.last_name,
      'customer_name', c.name
    ),
    ce.created_at
  FROM customer_employee ce
  JOIN customer c ON c.id = ce.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

  -- 8. Comptes bancaires ajoutés
  INSERT INTO firm_inbox (firm_id, event_type, source_type, source_id, customer_id, payload, event_at)
  SELECT
    cba.firm_id,
    'account_added',
    'customer_bank_account',
    cba.id,
    cba.customer_id,
    jsonb_build_object(
      'bank_name',     b.name,
      'customer_name', c.name
    ),
    cba.created_at
  FROM customer_bank_account cba
  JOIN bank     b ON b.id  = cba.bank_id
  JOIN customer c ON c.id  = cba.customer_id
  ON CONFLICT (firm_id, source_type, source_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fill_firm_inbox TO service_role;

-- ── pg_cron : toutes les 2 minutes ──────────────────────────

DO $$ BEGIN
  PERFORM cron.schedule('fill-firm-inbox', '*/2 * * * *', 'SELECT fill_firm_inbox()');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Population initiale
SELECT fill_firm_inbox();
