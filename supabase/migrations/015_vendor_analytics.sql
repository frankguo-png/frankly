CREATE INDEX IF NOT EXISTS idx_transactions_org_vendor ON transactions(org_id, vendor, date) WHERE is_duplicate = false AND vendor IS NOT NULL;
