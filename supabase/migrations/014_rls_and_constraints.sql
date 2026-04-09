-- RLS policies for new tables (defense-in-depth)
alter table review_cycles enable row level security;
alter table performance_reviews enable row level security;
alter table review_goals enable row level security;
alter table bonuses enable row level security;
alter table bonus_approvals enable row level security;

-- Org-scoped policies (authenticated users can access their own org's data)
create policy "review_cycles_org_access" on review_cycles
  for all using (org_id in (select org_id from user_organizations where user_id = auth.uid()));

create policy "performance_reviews_org_access" on performance_reviews
  for all using (org_id in (select org_id from user_organizations where user_id = auth.uid()));

create policy "review_goals_access" on review_goals
  for all using (review_id in (select id from performance_reviews where org_id in (select org_id from user_organizations where user_id = auth.uid())));

create policy "bonuses_org_access" on bonuses
  for all using (org_id in (select org_id from user_organizations where user_id = auth.uid()));

create policy "bonus_approvals_access" on bonus_approvals
  for all using (bonus_id in (select id from bonuses where org_id in (select org_id from user_organizations where user_id = auth.uid())));

-- NOT NULL on org_id columns (prevent orphaned rows)
alter table review_cycles alter column org_id set not null;
alter table performance_reviews alter column org_id set not null;
alter table bonuses alter column org_id set not null;

-- Prevent duplicate reviews per employee per cycle
alter table performance_reviews add constraint unique_review_per_cycle
  unique (cycle_id, employee_id);
