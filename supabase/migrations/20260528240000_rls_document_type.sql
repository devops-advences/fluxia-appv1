-- document_type is a global reference table — all authenticated users can read
ALTER TABLE document_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_type_select_all" ON document_type
  FOR SELECT TO authenticated USING (true);
