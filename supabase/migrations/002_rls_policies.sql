-- 002_rls_policies.sql
-- Ampliwork Financial Dashboard - Row Level Security

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Helper: inline sub-select for the current user's org memberships
-- =============================================================================
-- Used in every policy below:
--   org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())

-- =============================================================================
-- organizations
-- =============================================================================
CREATE POLICY "org_select" ON organizations FOR SELECT
    USING (id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "org_insert" ON organizations FOR INSERT
    WITH CHECK (id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "org_update" ON organizations FOR UPDATE
    USING (id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "org_delete" ON organizations FOR DELETE
    USING (id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

-- =============================================================================
-- user_organizations
-- =============================================================================
CREATE POLICY "user_org_select" ON user_organizations FOR SELECT
    USING (org_id IN (SELECT uo.org_id FROM user_organizations uo WHERE uo.user_id = auth.uid()));

CREATE POLICY "user_org_insert" ON user_organizations FOR INSERT
    WITH CHECK (org_id IN (SELECT uo.org_id FROM user_organizations uo WHERE uo.user_id = auth.uid()));

CREATE POLICY "user_org_update" ON user_organizations FOR UPDATE
    USING (org_id IN (SELECT uo.org_id FROM user_organizations uo WHERE uo.user_id = auth.uid()));

CREATE POLICY "user_org_delete" ON user_organizations FOR DELETE
    USING (org_id IN (SELECT uo.org_id FROM user_organizations uo WHERE uo.user_id = auth.uid()));

-- =============================================================================
-- bank_accounts
-- =============================================================================
CREATE POLICY "bank_accounts_select" ON bank_accounts FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "bank_accounts_insert" ON bank_accounts FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "bank_accounts_update" ON bank_accounts FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "bank_accounts_delete" ON bank_accounts FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

-- =============================================================================
-- transactions
-- =============================================================================
CREATE POLICY "transactions_select" ON transactions FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "transactions_insert" ON transactions FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "transactions_update" ON transactions FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "transactions_delete" ON transactions FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

-- =============================================================================
-- payroll_allocations
-- =============================================================================
CREATE POLICY "payroll_select" ON payroll_allocations FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "payroll_insert" ON payroll_allocations FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "payroll_update" ON payroll_allocations FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "payroll_delete" ON payroll_allocations FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

-- =============================================================================
-- sync_log
-- =============================================================================
CREATE POLICY "sync_log_select" ON sync_log FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "sync_log_insert" ON sync_log FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "sync_log_update" ON sync_log FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "sync_log_delete" ON sync_log FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

-- =============================================================================
-- category_rules
-- =============================================================================
CREATE POLICY "category_rules_select" ON category_rules FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "category_rules_insert" ON category_rules FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "category_rules_update" ON category_rules FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "category_rules_delete" ON category_rules FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()));
