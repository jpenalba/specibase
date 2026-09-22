-- Saved GBIF species range layers for the Database page's map. Each row is
-- a species someone chose to keep tracking as an occurrence-density tile
-- overlay (see src/lib/gbif.ts) — no occurrence data is stored here, just
-- which species and which color style to request tiles in.

create table if not exists gbif_species_layers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- GBIF's own numeric identifier for this taxon (its "usageKey"/"key").
  taxon_key bigint not null unique,
  scientific_name text not null,
  rank text,
  style text not null default 'classic.point'
);

alter table gbif_species_layers enable row level security;
