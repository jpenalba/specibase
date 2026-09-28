-- Lets a protocol be attached to one or more projects, same shape as
-- sample_projects for samples.
create table if not exists protocol_projects (
  protocol_id uuid not null references protocols (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (protocol_id, project_id)
);

alter table protocol_projects enable row level security;

-- Tags an activity_log entry with the project it happened in, so a
-- project's own Logs tab can show just its slice of the feed. Null means
-- the action wasn't scoped to one project (most entries today — a sample
-- edit from the shared Database, say). set null on delete rather than
-- cascade: a deleted project's log entries stay in the global feed
-- instead of disappearing with it.
alter table activity_log add column if not exists project_id uuid references projects (id) on delete set null;
