-- Composite indexes for common dashboard query patterns
-- Transactions are the most queried table; these cover the KPI, spend, and time-series endpoints

create index if not exists idx_transactions_org_date_nodupe
  on transactions(org_id, date)
  where is_duplicate = false;

create index if not exists idx_transactions_org_category
  on transactions(org_id, category)
  where is_duplicate = false and amount < 0;

create index if not exists idx_transactions_org_department
  on transactions(org_id, department)
  where is_duplicate = false and amount < 0;

-- Performance reviews: common filters
create index if not exists idx_perf_reviews_cycle_status
  on performance_reviews(cycle_id, status);

-- Bonuses: approval queue and payout queries
create index if not exists idx_bonuses_org_status_type
  on bonuses(org_id, status, bonus_type);
