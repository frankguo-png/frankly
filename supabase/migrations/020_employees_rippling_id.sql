-- Lets the employees table sync from Rippling, whose IDs are MongoDB ObjectIDs (not UUIDs).
-- The internal `id` remains a UUID (so existing FKs from bonuses, performance_reviews, etc.
-- stay intact); Rippling's IDs live alongside in `rippling_id` / `rippling_manager_id`.

alter table employees add column if not exists rippling_id text;
alter table employees add column if not exists rippling_manager_id text;

-- Plain (non-partial) unique index — PostgREST's ON CONFLICT can't match a partial index.
-- Multiple NULLs are fine: Postgres default (NULLS DISTINCT) treats each NULL as unique.
drop index if exists idx_employees_org_rippling_id;
create unique index idx_employees_org_rippling_id
  on employees(org_id, rippling_id);

create index if not exists idx_employees_rippling_manager_id
  on employees(rippling_manager_id);
