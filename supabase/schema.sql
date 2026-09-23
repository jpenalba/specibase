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
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  -- Free-form markdown shown in the project's Info tab; null means
  -- nothing's been written yet for that section.
  background text,
  notes text,

  -- Samples-tab map styling — see supabase/migrations/0016_project_marker_styles.sql.
  marker_style_field text,
  marker_color text,
  marker_shape text check (marker_shape in ('circle', 'square', 'triangle', 'diamond'))
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

-- Lab Workflow: a project can have any number of customizable workflows,
-- each a sequence of steps tracked per enrolled sample. See
-- supabase/migrations/0007_lab_workflows.sql for the per-table notes.
create table if not exists lab_workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed'))
);

create table if not exists lab_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  step_key text not null,
  label text not null
);

create table if not exists lab_workflow_samples (
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (workflow_id, sample_id)
);

create table if not exists lab_workflow_entries (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references lab_workflow_steps (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'failed')),
  method text,
  date date,
  performed_by text,
  quantification jsonb,
  notes text,

  unique (step_id, sample_id)
);

create index if not exists lab_workflow_steps_workflow_id_idx on lab_workflow_steps (workflow_id);
create index if not exists lab_workflow_samples_sample_id_idx on lab_workflow_samples (sample_id);
create index if not exists lab_workflow_entries_sample_id_idx on lab_workflow_entries (sample_id);

-- References section of a project's Info tab. See
-- supabase/migrations/0010_project_references.sql for the per-column notes.
create table if not exists project_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  citation text not null,
  sort_key text not null,
  doi text,
  source jsonb
);

create index if not exists project_references_project_id_idx on project_references (project_id);

-- "Bioinformatic notes" tab: a notebook of titled, dated markdown blocks.
-- See supabase/migrations/0015_project_bio_notes_blocks.sql.
create table if not exists project_bio_notes_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  position integer not null,
  title text not null,
  content text not null default ''
);

create index if not exists project_bio_notes_blocks_project_id_idx on project_bio_notes_blocks (project_id);

-- Per-value color/shape overrides when a project colors its Samples-tab
-- map by a field (marker_style_field) instead of one flat style — see
-- supabase/migrations/0016_project_marker_styles.sql.
create table if not exists project_marker_styles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  field_key text not null,
  field_value text not null,
  color text not null,
  shape text not null default 'circle' check (shape in ('circle', 'square', 'triangle', 'diamond')),

  unique (project_id, field_key, field_value)
);

create index if not exists project_marker_styles_project_id_idx on project_marker_styles (project_id);

-- Custom, free-text columns on a workflow's Simple grid (e.g. an
-- extraction or library name) — see
-- supabase/migrations/0011_lab_workflow_custom_columns.sql.
create table if not exists lab_workflow_custom_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null
);

create table if not exists lab_workflow_custom_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references lab_workflow_custom_columns (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, sample_id)
);

create index if not exists lab_workflow_custom_columns_workflow_id_idx on lab_workflow_custom_columns (workflow_id);
create index if not exists lab_workflow_custom_values_sample_id_idx on lab_workflow_custom_values (sample_id);

-- The Detailed view's single, fully customizable table per workflow — see
-- supabase/migrations/0012_lab_workflow_detail_columns.sql and
-- 0013_lab_workflow_detail_rows.sql. Status (kind = 'status') is seeded by
-- application code (createWorkflow) for every new workflow.
create table if not exists lab_workflow_detail_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null,
  kind text not null default 'text' check (kind in ('text', 'date', 'status'))
);

-- One row per attempt at a sample, not one row per sample — a sample that
-- needs to be redone gets a second (or third, ...) row via the "Duplicate
-- row" action, distinguished by attempt_number. Every enrolled sample gets
-- its attempt_number = 1 row from application code (enrollSamples).
create table if not exists lab_workflow_detail_rows (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  created_at timestamptz not null default now(),

  attempt_number integer not null default 1,

  unique (workflow_id, sample_id, attempt_number)
);

create table if not exists lab_workflow_detail_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references lab_workflow_detail_columns (id) on delete cascade,
  row_id uuid not null references lab_workflow_detail_rows (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, row_id)
);

create index if not exists lab_workflow_detail_columns_workflow_id_idx on lab_workflow_detail_columns (workflow_id);
create index if not exists lab_workflow_detail_rows_workflow_id_idx on lab_workflow_detail_rows (workflow_id);
create index if not exists lab_workflow_detail_rows_sample_id_idx on lab_workflow_detail_rows (sample_id);
create index if not exists lab_workflow_detail_values_row_id_idx on lab_workflow_detail_values (row_id);

-- Bioinformatic workflow — the same table design as Lab Workflow above,
-- under its own names, with a different preset vocabulary
-- (src/lib/bio-workflow-steps.ts, bio-workflow-detail-columns.ts). See
-- supabase/migrations/0014_bio_workflows.sql.
create table if not exists bio_workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed'))
);

create table if not exists bio_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references bio_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  step_key text not null,
  label text not null
);

create table if not exists bio_workflow_samples (
  workflow_id uuid not null references bio_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (workflow_id, sample_id)
);

create table if not exists bio_workflow_entries (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references bio_workflow_steps (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'failed')),
  method text,
  date date,
  performed_by text,
  quantification jsonb,
  notes text,

  unique (step_id, sample_id)
);

create table if not exists bio_workflow_custom_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references bio_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null
);

create table if not exists bio_workflow_custom_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references bio_workflow_custom_columns (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, sample_id)
);

create table if not exists bio_workflow_detail_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references bio_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null,
  kind text not null default 'text' check (kind in ('text', 'date', 'status'))
);

create table if not exists bio_workflow_detail_rows (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references bio_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  created_at timestamptz not null default now(),

  attempt_number integer not null default 1,

  unique (workflow_id, sample_id, attempt_number)
);

create table if not exists bio_workflow_detail_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references bio_workflow_detail_columns (id) on delete cascade,
  row_id uuid not null references bio_workflow_detail_rows (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, row_id)
);

create index if not exists bio_workflow_steps_workflow_id_idx on bio_workflow_steps (workflow_id);
create index if not exists bio_workflow_samples_sample_id_idx on bio_workflow_samples (sample_id);
create index if not exists bio_workflow_entries_sample_id_idx on bio_workflow_entries (sample_id);
create index if not exists bio_workflow_custom_columns_workflow_id_idx on bio_workflow_custom_columns (workflow_id);
create index if not exists bio_workflow_custom_values_sample_id_idx on bio_workflow_custom_values (sample_id);
create index if not exists bio_workflow_detail_columns_workflow_id_idx on bio_workflow_detail_columns (workflow_id);
create index if not exists bio_workflow_detail_rows_workflow_id_idx on bio_workflow_detail_rows (workflow_id);
create index if not exists bio_workflow_detail_rows_sample_id_idx on bio_workflow_detail_rows (sample_id);
create index if not exists bio_workflow_detail_values_row_id_idx on bio_workflow_detail_values (row_id);

-- No client code ever talks to Supabase directly (the app's own API routes
-- do, using the service role key, which bypasses RLS) — this just makes
-- sure that stays true if an anon-key client ever gets added by mistake.
alter table samples enable row level security;
alter table projects enable row level security;
alter table sample_projects enable row level security;
alter table collections enable row level security;
alter table collection_samples enable row level security;
alter table gbif_species_layers enable row level security;
alter table lab_workflows enable row level security;
alter table lab_workflow_steps enable row level security;
alter table lab_workflow_samples enable row level security;
alter table lab_workflow_entries enable row level security;
alter table project_references enable row level security;
alter table lab_workflow_custom_columns enable row level security;
alter table lab_workflow_custom_values enable row level security;
alter table lab_workflow_detail_columns enable row level security;
alter table lab_workflow_detail_rows enable row level security;
alter table lab_workflow_detail_values enable row level security;
alter table bio_workflows enable row level security;
alter table bio_workflow_steps enable row level security;
alter table bio_workflow_samples enable row level security;
alter table bio_workflow_entries enable row level security;
alter table bio_workflow_custom_columns enable row level security;
alter table bio_workflow_custom_values enable row level security;
alter table bio_workflow_detail_columns enable row level security;
alter table bio_workflow_detail_rows enable row level security;
alter table bio_workflow_detail_values enable row level security;
alter table project_bio_notes_blocks enable row level security;
alter table project_marker_styles enable row level security;

-- Public bucket for images inserted into a project's Background markdown
-- (see src/app/api/projects/[id]/background/images) — public because the
-- app has no per-user auth yet, same reasoning as everything else here.
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;
