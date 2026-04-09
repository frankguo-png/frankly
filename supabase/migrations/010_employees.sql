create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  name text not null,
  title text,
  department text,
  manager_id uuid references employees(id),
  email text,
  avatar_url text,
  status text default 'active' check (status in ('active', 'inactive')),
  start_date date,
  salary numeric,
  created_at timestamptz default now()
);

create index idx_employees_org_id on employees(org_id);
create index idx_employees_manager_id on employees(manager_id);
create index idx_employees_status on employees(status);
