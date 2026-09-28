-- Profile photo, department, and a chosen username — see the account
-- dropdown's Profile section (AUTH_AND_PERMISSIONS_PLAN.md).
--
-- `avatars`: a public Storage bucket for profile photos, same reasoning
-- as `project-images`/`protocol-files` — no per-account access control on
-- storage buckets yet, so a public file URL isn't a new exposure (nothing
-- sensitive lives in a profile photo).
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists department text;

-- Chosen at account setup (or filled in later from the Profile dialog —
-- there's no self-service sign-up yet to prompt for it at creation time).
-- Nullable: an account that hasn't set one yet just signs in with email.
-- Case-insensitive uniqueness (an index rather than a plain unique
-- constraint, since Postgres can't express "unique on lower(x)" as a
-- column constraint) so "Jane" and "jane" can't both be claimed.
alter table profiles add column if not exists username text;
create unique index if not exists profiles_username_unique_idx on profiles (lower(username));

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
