-- Run this once in the Supabase SQL Editor. Adds a lightweight activity
-- feed — one row per meaningful change (a sample added, a project
-- updated, a protocol deleted, ...) — shown on the new /logs page.
--
-- Deliberately just entity_type/action/summary, no entity_id or diff of
-- old/new values — this is a human-readable feed to answer "what's
-- happened," not a full audit trail. `summary` is precomputed at write
-- time by the API route that made the change, so the Logs page never has
-- to re-derive text from raw data.
--
-- `app_settings` is a single-row table (id is always 1) holding whether
-- logging is currently turned on — there's no per-user auth in this app,
-- so this is one shared, app-wide switch rather than a per-user
-- preference.

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  entity_type text not null,
  action text not null,
  summary text not null
);

create index if not exists activity_log_created_at_idx on activity_log (created_at desc);

create table if not exists app_settings (
  id smallint primary key default 1 check (id = 1),
  activity_logging_enabled boolean not null default true
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table activity_log enable row level security;
alter table app_settings enable row level security;
