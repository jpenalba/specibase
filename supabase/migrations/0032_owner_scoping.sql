-- Personal data scoping (Phase 2 of AUTH_AND_PERMISSIONS_PLAN.md) —
-- samples, collections, protocols, and the samples' own custom column
-- definitions become private to the account that owns them, instead of
-- one shared pool everyone who logs in can see. Projects are unaffected
-- here — they stay the shared surface, per the plan; per-project roles
-- and membership are a later phase.
--
-- Existing rows all predate accounts, so every one of them gets backfilled
-- to whichever account was created first — in practice, the only account
-- that exists at the time this is run.

do $$
begin
  if not exists (select 1 from profiles) then
    raise exception 'No accounts exist yet — sign in at /login once (see AUTH_AND_PERMISSIONS_PLAN.md Phase 1) before running this migration, so existing data has an owner to backfill to.';
  end if;
end $$;

alter table samples add column if not exists owner_id uuid references profiles (id);
update samples set owner_id = (select id from profiles order by created_at asc limit 1) where owner_id is null;
alter table samples alter column owner_id set not null;
-- Sample IDs only need to be unique within one account's own database now,
-- not globally — same idea collection_samples already used for an
-- external collection's own accession numbers.
alter table samples drop constraint if exists samples_primary_identifier_key;
alter table samples add constraint samples_owner_id_primary_identifier_key unique (owner_id, primary_identifier);

alter table collections add column if not exists owner_id uuid references profiles (id);
update collections set owner_id = (select id from profiles order by created_at asc limit 1) where owner_id is null;
alter table collections alter column owner_id set not null;
alter table collections drop constraint if exists collections_name_key;
alter table collections add constraint collections_owner_id_name_key unique (owner_id, name);

alter table protocols add column if not exists owner_id uuid references profiles (id);
update protocols set owner_id = (select id from profiles order by created_at asc limit 1) where owner_id is null;
alter table protocols alter column owner_id set not null;

alter table sample_custom_columns add column if not exists owner_id uuid references profiles (id);
update sample_custom_columns set owner_id = (select id from profiles order by created_at asc limit 1) where owner_id is null;
alter table sample_custom_columns alter column owner_id set not null;
