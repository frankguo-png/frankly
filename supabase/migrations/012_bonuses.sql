-- Bonus records with approval workflow
create table if not exists bonuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  employee_id uuid references employees(id),
  proposed_by uuid references employees(id),
  bonus_type text not null check (bonus_type in (
    'annual_performance', 'spot', 'retention', 'signing', 'project_completion', 'referral'
  )),
  amount numeric not null,
  percentage_of_salary numeric,        -- if calculated as % of base
  base_salary_at_time numeric,         -- snapshot for audit
  related_review_id uuid references performance_reviews(id),
  performance_rating_at_time numeric,  -- snapshot of rating used
  reason text,
  status text default 'draft' check (status in (
    'draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'paid'
  )),
  fiscal_year integer,
  fiscal_quarter integer check (fiscal_quarter >= 1 and fiscal_quarter <= 4),
  effective_date date,
  payout_date date,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_bonuses_org on bonuses(org_id);
create index idx_bonuses_employee on bonuses(employee_id);
create index idx_bonuses_status on bonuses(status);
create index idx_bonuses_type on bonuses(bonus_type);

-- Approval chain entries for each bonus
create table if not exists bonus_approvals (
  id uuid primary key default gen_random_uuid(),
  bonus_id uuid references bonuses(id) on delete cascade,
  approver_id uuid references employees(id),
  approver_role text,                  -- e.g. 'manager', 'hr', 'finance', 'director'
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comments text,
  decided_at timestamptz,
  approval_order integer default 1,
  created_at timestamptz default now()
);

create index idx_bonus_approvals_bonus on bonus_approvals(bonus_id);
create index idx_bonus_approvals_approver on bonus_approvals(approver_id);
