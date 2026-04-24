-- Additional fields synced from Rippling's worker payload.
-- country: 2-letter code for auto-entity tagging (US, CA, GB, ...).
-- location_type: WORK (office) | REMOTE.
-- is_manager: Rippling's flag, with a sync-side fallback that flips true
--             if any other worker has this person as their manager.
-- salary_effective_date: date of last compensation change from Rippling.

alter table employees add column if not exists country text;
alter table employees add column if not exists location_type text;
alter table employees add column if not exists is_manager boolean not null default false;
alter table employees add column if not exists salary_effective_date date;

create index if not exists idx_employees_is_manager on employees(org_id) where is_manager;
