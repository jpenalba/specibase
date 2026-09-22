-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- for a brand new project. If you already ran an earlier version of this
-- file, use supabase/migrations/0001_optional_location_and_projects.sql
-- instead, which updates an existing `samples` table in place.
--
-- Matches the field set in src/lib/fields.ts. When a new optional field is
-- added there, add the matching column here too.

create extension if not exists pgcrypto;

create table if not exists samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- required
  primary_identifier text not null unique,
  species text not null,

  -- location: either latitude+longitude or locality is required (not
  -- each individually) — enforced by the app and mirrored here
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  locality text,

  -- optional
  collection_date date,
  country text,
  additional_number text,
  collector text,
  tissue_type text,
  storage_location text,
  notes text,

  constraint samples_coords_paired check ((latitude is null) = (longitude is null)),
  constraint samples_location_required check (
    (latitude is not null and longitude is not null) or locality is not null
  )
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),

  description text,
  start_date date,
  owner text,
  collaborators text,
  focal_group text,
  focal_region text,
  -- An explicit icon choice (one of the categories in
  -- src/lib/focal-group.ts); null means auto-match against focal_group.
  logo text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed'))
);

create table if not exists sample_projects (
  sample_id uuid not null references samples (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sample_id, project_id)
);

-- External collections (a museum's, a collaborator's) — useful to track
-- but not part of the main database, so their samples live in their own
-- table entirely rather than in `samples`.
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),

  description text,
  date_added date not null default current_date,
  focal_group text,
  location text,
  contacts text
);

create table if not exists collection_samples (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Same shape as `samples` above, but Sample IDs are only unique within
  -- a collection — an external collection's own accession numbers have no
  -- reason to avoid colliding with ours or another collection's.
  primary_identifier text not null,
  species text not null,

  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  locality text,

  collection_date date,
  country text,
  additional_number text,
  collector text,
  tissue_type text,
  storage_location text,
  notes text,

  constraint collection_samples_coords_paired check ((latitude is null) = (longitude is null)),
  constraint collection_samples_location_required check (
    (latitude is not null and longitude is not null) or locality is not null
  ),
  unique (collection_id, primary_identifier)
);

-- Saved GBIF species range layers for the Database page's map — see
-- src/lib/gbif.ts. No occurrence data is stored here, just which species
-- and which color style to request occurrence-density tiles in.
create table if not exists gbif_species_layers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- GBIF's own numeric identifier for this taxon (its "usageKey"/"key").
  taxon_key bigint not null unique,
  scientific_name text not null,
  rank text,
  style text not null default 'classic.point'
);

-- No client code ever talks to Supabase directly (the app's own API routes
-- do, using the service role key, which bypasses RLS) — this just makes
-- sure that stays true if an anon-key client ever gets added by mistake.
alter table samples enable row level security;
alter table projects enable row level security;
alter table sample_projects enable row level security;
alter table collections enable row level security;
alter table collection_samples enable row level security;
alter table gbif_species_layers enable row level security;
