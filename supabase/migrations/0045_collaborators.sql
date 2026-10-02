-- A personal address book: people this account often shares projects and
-- collections with, surfaced as a quick-pick in the Members dialogs
-- instead of retyping the same email/username every time. Directional
-- (collaborators(user_id, collaborator_id) isn't symmetric) and manually
-- maintained — adding someone here has no effect on any project's or
-- collection's actual membership, and vice versa.
create table if not exists collaborators (
  user_id uuid not null references profiles (id) on delete cascade,
  collaborator_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collaborator_id),
  constraint collaborators_not_self check (user_id <> collaborator_id)
);

create index if not exists collaborators_collaborator_id_idx on collaborators (collaborator_id);

alter table collaborators enable row level security;
