-- Nav-bar notifications (AccountMenu's bell) — starts with a single kind,
-- "someone shared a project with you," but kept generic (type + project_id)
-- so another kind can be added later without another migration.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Who sees this in their nav bar.
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('project_shared')),

  -- Which project it's about (cascades — a notification pointing at a
  -- project that no longer exists has nowhere left to send a click), and
  -- who did the sharing (set null instead: the notification's own text is
  -- rendered once, from whoever was the actor at the time, so there's
  -- nothing left for a deleted actor's id to break).
  project_id uuid references projects (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,

  -- Null means still unseen (shows in the bell); set once the person
  -- clicks it, same single-purpose use as activity_log's undone_at.
  seen_at timestamptz
);

create index if not exists notifications_user_id_unseen_idx
  on notifications (user_id)
  where seen_at is null;

alter table notifications enable row level security;
