-- Allow filtering payroll / team views by entity, auto-tagged from Rippling's
-- worker.country. ON DELETE SET NULL so deleting an entity doesn't cascade into
-- HR data.

alter table employees
  add column if not exists entity_id uuid references entities(id) on delete set null;

alter table payroll_allocations
  add column if not exists entity_id uuid references entities(id) on delete set null;

create index if not exists idx_employees_entity on employees(entity_id);
create index if not exists idx_payroll_allocations_entity on payroll_allocations(entity_id);
