create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  name text not null,
  company text,
  amount numeric not null,
  probability integer default 50 check (probability between 0 and 100),
  stage text default 'pitched' check (stage in ('pitched', 'negotiating', 'verbal', 'closed_won', 'closed_lost')),
  expected_close_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fetching active deals by org
create index if not exists idx_deals_org_active on deals (org_id, stage) where stage != 'closed_lost';
