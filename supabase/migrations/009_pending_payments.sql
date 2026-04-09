create table if not exists pending_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  vendor text not null,
  description text,
  amount numeric not null,
  due_date date not null,
  priority text default 'normal' check (priority in ('critical', 'high', 'normal', 'low')),
  status text default 'pending' check (status in ('pending', 'overdue', 'paid', 'scheduled')),
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast dashboard queries
create index if not exists idx_pending_payments_org_status
  on pending_payments(org_id, status, due_date);
