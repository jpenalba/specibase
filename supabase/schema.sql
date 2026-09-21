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
  focal_region text
);

create table if not exists sample_projects (
  sample_id uuid not null references samples (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sample_id, project_id)
);

-- No client code ever talks to Supabase directly (the app's own API routes
-- do, using the service role key, which bypasses RLS) — this just makes
-- sure that stays true if an anon-key client ever gets added by mistake.
alter table samples enable row level security;
alter table projects enable row level security;
alter table sample_projects enable row level security;
