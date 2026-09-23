-- Run this once in the Supabase SQL Editor. Adds four more optional
-- columns (see src/lib/fields.ts): Sex, Institution/repository,
-- Preservation method, and a repository-agnostic Data repository
-- accession field (GenBank, ENA, DDBJ, or anything else — deliberately
-- not GenBank-specific).

alter table samples add column if not exists sex text
  check (sex is null or sex in ('Male', 'Female', 'Unknown'));
alter table samples add column if not exists institution text;
alter table samples add column if not exists preservation_method text;
alter table samples add column if not exists repository_accession text;

alter table collection_samples add column if not exists sex text
  check (sex is null or sex in ('Male', 'Female', 'Unknown'));
alter table collection_samples add column if not exists institution text;
alter table collection_samples add column if not exists preservation_method text;
alter table collection_samples add column if not exists repository_accession text;
