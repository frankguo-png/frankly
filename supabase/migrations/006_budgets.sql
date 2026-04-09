-- 006_budgets.sql
-- Ampliwork Financial Dashboard - Budget vs Actual Tracking

CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  category TEXT,          -- NULL means total budget
  department TEXT,
  project TEXT,
  monthly_amount NUMERIC(12,2) NOT NULL,
  effective_month TEXT NOT NULL, -- '2026-01' format
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_budgets_org ON budgets(org_id);
CREATE INDEX idx_budgets_month ON budgets(org_id, effective_month);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies for budgets (matching pattern from 002_rls_policies.sql)
-- =============================================================================
CREATE POLICY "budgets_select" ON budgets FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "budgets_insert" ON budgets FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "budgets_update" ON budgets FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "budgets_delete" ON budgets FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
