CREATE TABLE IF NOT EXISTS qbo_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  company_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'error', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qbo_connections_org ON qbo_connections(org_id);
ALTER TABLE qbo_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qbo_select" ON qbo_connections FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
CREATE POLICY "qbo_insert" ON qbo_connections FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
CREATE POLICY "qbo_update" ON qbo_connections FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
CREATE POLICY "qbo_delete" ON qbo_connections FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
