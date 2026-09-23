-- Run this once in the Supabase SQL Editor. Adds subspecies plus the four
-- higher taxonomic ranks (genus/family/order/class) tracked in
-- src/lib/fields.ts as their own optional columns. Genus/family/order/class
-- are auto-filled from a GBIF species/match lookup when possible (see
-- src/lib/gbif.ts's matchGbifSpecies), but stay ordinary editable text
-- columns — an unmatched species (undescribed, a morphospecies code) just
-- leaves them blank rather than blocking the sample.
--
-- "order" and "class" are avoided as bare column names since order is a
-- reserved SQL keyword (class isn't, but taxon_class keeps the pair
-- consistent) — see the taxon_order/taxon_class keys in fields.ts.

alter table samples add column if not exists subspecies text;
alter table samples add column if not exists genus text;
alter table samples add column if not exists family text;
alter table samples add column if not exists taxon_order text;
alter table samples add column if not exists taxon_class text;

alter table collection_samples add column if not exists subspecies text;
alter table collection_samples add column if not exists genus text;
alter table collection_samples add column if not exists family text;
alter table collection_samples add column if not exists taxon_order text;
alter table collection_samples add column if not exists taxon_class text;
