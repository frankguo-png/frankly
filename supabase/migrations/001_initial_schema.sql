-- 001_initial_schema.sql
-- Ampliwork Financial Dashboard - Initial Schema

-- =============================================================================
-- 1. Organizations
-- =============================================================================
CREATE TABLE organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. User-Organization memberships
-- =============================================================================
CREATE TABLE user_organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    org_id     UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, org_id)
);

-- =============================================================================
-- 3. Bank Accounts (Plaid-linked)
-- =============================================================================
CREATE TABLE bank_accounts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    plaid_item_id      TEXT,
    plaid_access_token TEXT,
    plaid_account_id   TEXT,
    bank_name          TEXT NOT NULL,
    account_name       TEXT,
    account_type       TEXT,
    currency           TEXT NOT NULL DEFAULT 'USD',
    current_balance    NUMERIC(15, 2),
    available_balance  NUMERIC(15, 2),
    last_synced_at     TIMESTAMPTZ,
    plaid_cursor       TEXT,
    connection_status  TEXT NOT NULL DEFAULT 'active'
                       CHECK (connection_status IN ('active', 'error', 'disconnected')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_accounts_org_id ON bank_accounts (org_id);

-- =============================================================================
-- 4. Transactions
-- =============================================================================
CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    bank_account_id         UUID REFERENCES bank_accounts (id) ON DELETE SET NULL,
    date                    DATE NOT NULL,
    amount                  NUMERIC(15, 2) NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'USD',
    description             TEXT,
    vendor                  TEXT,
    category                TEXT,
    department              TEXT,
    project                 TEXT,
    source                  TEXT NOT NULL
                            CHECK (source IN ('plaid', 'qbo', 'rippling', 'manual')),
    source_transaction_id   TEXT,
    is_duplicate            BOOLEAN NOT NULL DEFAULT false,
    merged_with             UUID,
    is_transfer             BOOLEAN NOT NULL DEFAULT false,
    categorization_status   TEXT NOT NULL DEFAULT 'uncategorized'
                            CHECK (categorization_status IN ('uncategorized', 'rule_matched', 'ai_suggested', 'manual')),
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_transactions_source_dedup
    ON transactions (org_id, source, source_transaction_id);

CREATE INDEX idx_transactions_org_date       ON transactions (org_id, date);
CREATE INDEX idx_transactions_org_category   ON transactions (org_id, category);
CREATE INDEX idx_transactions_org_department ON transactions (org_id, department);
CREATE INDEX idx_transactions_org_project    ON transactions (org_id, project);

-- =============================================================================
-- 5. Payroll Allocations
-- =============================================================================
CREATE TABLE payroll_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    employee_id         TEXT NOT NULL,
    employee_name       TEXT NOT NULL,
    employment_type     TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'hourly', 'intern')),
    annual_salary       NUMERIC(15, 2),
    department          TEXT,
    project_allocations JSONB NOT NULL DEFAULT '[]',
    effective_date      DATE NOT NULL,
    end_date            DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_payroll_allocations_dedup
    ON payroll_allocations (org_id, employee_id, effective_date);

-- =============================================================================
-- 6. Sync Log
-- =============================================================================
CREATE TABLE sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    source          TEXT NOT NULL,
    sync_type       TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    records_fetched INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed')),
    error_message   TEXT
);

CREATE INDEX idx_sync_log_org_source ON sync_log (org_id, source, started_at DESC);

-- =============================================================================
-- 7. Category Rules
-- =============================================================================
CREATE TABLE category_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    rule_name         TEXT,
    rule_type         TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex')),
    match_field       TEXT NOT NULL CHECK (match_field IN ('vendor', 'description', 'amount')),
    match_value       TEXT NOT NULL,
    target_category   TEXT,
    target_department TEXT,
    target_project    TEXT,
    priority          INTEGER NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_category_rules_org_active ON category_rules (org_id, is_active, priority);

-- =============================================================================
-- updated_at trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
