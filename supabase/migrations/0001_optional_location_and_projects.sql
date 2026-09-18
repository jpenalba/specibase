-- Run this once in the Supabase SQL Editor against a database that already
-- has the original `samples` table (from the first version of schema.sql).
-- It updates that table in place instead of dropping any data, and adds
-- the new projects/sample_projects tables.

alter table samples alter column latitude drop not null;
alter table samples alter column longitude drop not null;

alter table samples
  add constraint samples_coords_paired check ((latitude is null) = (longitude is null));

alter table samples
  add constraint samples_location_required check (
    (latitude is not null and longitude is not null) or locality is not null
  );

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists sample_projects (
  sample_id uuid not null references samples (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sample_id, project_id)
);

alter table projects enable row level security;
alter table sample_projects enable row level security;
