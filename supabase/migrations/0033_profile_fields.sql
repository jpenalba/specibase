-- Editable profile fields, shown/edited from the account dropdown's
-- Profile section (see AUTH_AND_PERMISSIONS_PLAN.md) — display_name from
-- 0031_profiles.sql stays as-is, unused for now; the app computes a
-- display name from title/first_name/last_name once any of those are set.
alter table profiles add column if not exists title text
  check (title is null or title in ('Dr.', 'Prof', 'Ph.D.'));
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists institution text;
alter table profiles add column if not exists position text;
alter table profiles add column if not exists lab_group text;
