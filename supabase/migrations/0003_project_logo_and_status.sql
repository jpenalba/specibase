-- Run this once in the Supabase SQL Editor against a database that already
-- has the `projects` table with migration 0002 applied. Adds:
-- - `logo`: an explicit icon choice (one of the categories in
--   src/lib/focal-group.ts), overriding the automatic keyword match
--   against focal_group when set. Null means "keep auto-matching".
-- - `status`: shown as a badge on each project's card.

alter table projects add column if not exists logo text;
alter table projects add column if not exists status text not null default 'in_progress';

alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('in_progress', 'completed'));
