-- Run this once in the Supabase SQL Editor. Splits the old single
-- `additional_number` field (see src/lib/fields.ts) into three named
-- columns — museum_voucher, field_number, secondary_number — and adds a
-- Modern/Historical column (specimen_age).
--
-- additional_number itself is left in place rather than dropped, since
-- there's no reliable way to tell which of the three new categories any
-- existing value belongs to — its data is copied forward into
-- secondary_number (the closest match to its old "or other secondary ID"
-- catch-all wording) below, and the column stays around unused rather than
-- risking data loss. Feel free to drop it by hand later once you've
-- checked nothing still needs it.

alter table samples add column if not exists museum_voucher text;
alter table samples add column if not exists field_number text;
alter table samples add column if not exists secondary_number text;
alter table samples add column if not exists specimen_age text
  check (specimen_age is null or specimen_age in ('Modern', 'Historical'));

alter table collection_samples add column if not exists museum_voucher text;
alter table collection_samples add column if not exists field_number text;
alter table collection_samples add column if not exists secondary_number text;
alter table collection_samples add column if not exists specimen_age text
  check (specimen_age is null or specimen_age in ('Modern', 'Historical'));

update samples set secondary_number = additional_number
  where additional_number is not null and secondary_number is null;
update collection_samples set secondary_number = additional_number
  where additional_number is not null and secondary_number is null;
