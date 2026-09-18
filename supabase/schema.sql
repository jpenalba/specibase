-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Matches the field set in src/lib/fields.ts. When a new optional field is
-- added there, add the matching column here too.

create extension if not exists pgcrypto;

create table if not exists samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- required
  primary_identifier text not null unique,
  species text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- optional
  collection_date date,
  country text,
  locality text,
  additional_number text,
  collector text,
  tissue_type text,
  storage_location text,
  notes text
);

-- No client code ever talks to Supabase directly (the app's own API routes
-- do, using the service role key, which bypasses RLS) — this just makes
-- sure that stays true if an anon-key client ever gets added by mistake.
alter table samples enable row level security;
