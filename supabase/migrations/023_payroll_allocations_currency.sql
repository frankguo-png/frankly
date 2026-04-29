-- Currency context for payroll_allocations. Rippling returns compensation as
-- {currency_type, value} so we have to capture the currency or the dashboard
-- will treat ₹2,500,000 as $2,500,000.
alter table payroll_allocations
  add column if not exists currency text not null default 'USD';

create index if not exists idx_payroll_allocations_currency
  on payroll_allocations(currency);
