-- Entities represent legal/business units within an org (e.g. US, UK, Canada)
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  short_code text,
  currency text default 'USD',
  color text,
  created_at timestamptz not null default now(),
  unique(org_id, name)
);

create index idx_entities_org on entities(org_id);
alter table entities enable row level security;
create policy "entities_org_access" on entities
  for all using (org_id in (select org_id from user_organizations where user_id = auth.uid()));

-- Tag transactions, bank accounts, and QBO connections with entity
alter table transactions add column if not exists entity_id uuid references entities(id) on delete set null;
create index idx_transactions_org_entity on transactions(org_id, entity_id);

alter table bank_accounts add column if not exists entity_id uuid references entities(id) on delete set null;
alter table qbo_connections add column if not exists entity_id uuid references entities(id) on delete set null;
