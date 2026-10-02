-- Lets a collection be shared with other accounts — same role vocabulary
-- and upsert-based membership model as project_members (see
-- 0036_project_members.sql). collections.owner_id stays as-is (it still
-- backs the collections_owner_id_name_key uniqueness constraint), but
-- authorization for reading/writing a collection now goes through this
-- table via requireCollectionRole, not a hard owner_id match.
create table if not exists collection_members (
  collection_id uuid not null references collections (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create index if not exists collection_members_user_id_idx on collection_members (user_id);

-- Backfill: every existing collection's own owner_id becomes its first
-- Owner, so nothing already created goes orphaned.
insert into collection_members (collection_id, user_id, role)
select id, owner_id, 'owner' from collections
on conflict (collection_id, user_id) do nothing;

alter table collection_members enable row level security;

-- Widen the nav-bar notifications table (see 0040_notifications.sql) to
-- also carry "someone shared a collection with you," the same shape as
-- the existing project_shared kind.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('project_shared', 'collection_shared'));
alter table notifications add column if not exists collection_id uuid references collections (id) on delete cascade;
