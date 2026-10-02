-- Two latent bugs, both left behind by earlier app-level changes that
-- never got a matching database change:

-- 1. Latitude/longitude/locality stopped being required (any combination,
--    including none of the three, is valid now — see validation.ts) but
--    these CHECK constraints still demanded at least one, so the database
--    itself rejected a sample with none of the three even though the app
--    no longer blocks it.
alter table samples drop constraint if exists samples_location_required;
alter table collection_samples drop constraint if exists collection_samples_location_required;

-- 2. A soft-deleted sample's Sample ID stayed permanently unusable, even
--    for a brand-new sample — the plain unique constraints below count
--    deleted rows too, and the app-level duplicate check matched that on
--    purpose (see the old comment on existingIdentifiers), so an ID could
--    never actually be freed up by deleting its sample. Replaced with a
--    partial index that only enforces uniqueness among still-active rows,
--    so deleting (or restoring, on the other side) a sample immediately
--    frees or re-claims its ID. restoreSample/restoreCollectionSample now
--    report a clear error instead of a raw constraint-violation message
--    if, by the time someone clicks Undo, a different active row has
--    already claimed the same ID.
alter table samples drop constraint if exists samples_owner_id_primary_identifier_key;
create unique index if not exists samples_owner_id_primary_identifier_active_idx
  on samples (owner_id, primary_identifier)
  where deleted_at is null;

alter table collection_samples drop constraint if exists collection_samples_collection_id_primary_identifier_key;
create unique index if not exists collection_samples_collection_id_primary_identifier_active_idx
  on collection_samples (collection_id, primary_identifier)
  where deleted_at is null;
