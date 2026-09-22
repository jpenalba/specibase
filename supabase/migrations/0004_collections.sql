-- Collections: external sample sets worth tracking (a museum's, a
-- collaborator's) that stay separate from the main `samples` table and its
-- own project links — they're useful to the user but don't belong to them.

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

  -- Same shape as `samples` (see schema.sql), but Sample IDs are only
  -- unique within a collection — an external collection's own accession
  -- numbers have no reason to avoid colliding with ours or another
  -- collection's.
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

alter table collections enable row level security;
alter table collection_samples enable row level security;
