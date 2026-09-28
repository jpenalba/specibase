-- Phase 3 of AUTH_AND_PERMISSIONS_PLAN.md: project membership + roles.
-- Every project gets a membership list (Viewer/Editor/Owner); a project is
-- visible only to its members from here on, replacing the "every signed-in
-- account sees every project" behavior Phase 1/2 left in place.
create table if not exists project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on project_members (user_id);

-- Backfill: whichever account exists first (today's sole user, same
-- reasoning as 0032_owner_scoping.sql) becomes Owner of every project that
-- predates this migration, so nothing already created goes orphaned.
do $$
declare
  first_user uuid;
begin
  select id into first_user from profiles order by created_at asc limit 1;
  if first_user is not null then
    insert into project_members (project_id, user_id, role)
    select id, first_user, 'owner' from projects
    on conflict (project_id, user_id) do nothing;
  end if;
end $$;

-- Project names no longer need to be globally unique — different accounts'
-- projects are private from each other by default, and two strangers
-- calling their project "Pilot study" is normal now. Uniqueness is
-- app-enforced instead, scoped to the projects the creator can already see
-- (src/lib/projects-store.ts), the same way Sample IDs became per-owner
-- rather than global in 0032_owner_scoping.sql.
alter table projects drop constraint if exists projects_name_key;
