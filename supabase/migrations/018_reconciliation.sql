-- Reconciliation matches between bank (Plaid) and accounting (QBO) transactions
create table if not exists reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  bank_tx_id uuid references transactions(id) on delete cascade,
  accounting_tx_id uuid references transactions(id) on delete cascade,
  match_type text not null check (match_type in ('auto', 'manual')),
  match_confidence numeric(3,2),
  status text not null default 'matched' check (status in ('matched', 'dismissed', 'unmatched')),
  matched_by uuid,
  created_at timestamptz not null default now()
);

create index idx_recon_org on reconciliation_matches(org_id, status);
create index idx_recon_bank on reconciliation_matches(bank_tx_id);
create index idx_recon_accounting on reconciliation_matches(accounting_tx_id);

-- RLS
alter table reconciliation_matches enable row level security;
create policy "recon_org_access" on reconciliation_matches
  for all using (org_id in (select org_id from user_organizations where user_id = auth.uid()));
