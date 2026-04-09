-- Review cycles define the time period and deadlines for a round of reviews
create table if not exists review_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  name text not null,                -- e.g. "H1 2026", "Annual 2025"
  period_start date not null,
  period_end date not null,
  self_review_deadline date,
  manager_review_deadline date,
  calibration_deadline date,
  status text default 'draft' check (status in ('draft', 'active', 'calibration', 'finalized', 'closed')),
  created_at timestamptz default now()
);

create index idx_review_cycles_org on review_cycles(org_id);

-- Individual performance reviews, one per employee per cycle
create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  cycle_id uuid references review_cycles(id),
  employee_id uuid references employees(id),
  reviewer_id uuid references employees(id),      -- manager / assigned reviewer
  status text default 'not_started' check (status in (
    'not_started', 'self_review', 'manager_review', 'calibration', 'finalized', 'acknowledged'
  )),
  overall_rating numeric check (overall_rating >= 1 and overall_rating <= 5),
  strengths text,
  areas_for_improvement text,
  development_plan text,
  manager_comments text,
  employee_comments text,
  self_rating numeric check (self_rating >= 1 and self_rating <= 5),
  finalized_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_perf_reviews_org on performance_reviews(org_id);
create index idx_perf_reviews_cycle on performance_reviews(cycle_id);
create index idx_perf_reviews_employee on performance_reviews(employee_id);
create index idx_perf_reviews_status on performance_reviews(status);

-- Goals tracked within a review
create table if not exists review_goals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references performance_reviews(id) on delete cascade,
  description text not null,
  weight numeric default 1,          -- relative weight for weighted average
  self_rating numeric check (self_rating >= 1 and self_rating <= 5),
  manager_rating numeric check (manager_rating >= 1 and manager_rating <= 5),
  self_comments text,
  manager_comments text,
  goal_status text default 'in_progress' check (goal_status in ('not_started', 'in_progress', 'completed', 'exceeded')),
  created_at timestamptz default now()
);

create index idx_review_goals_review on review_goals(review_id);
