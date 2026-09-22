-- Run this once in the Supabase SQL Editor. Adds custom, free-text
-- columns to a workflow's Simple grid (src/components/lab-workflow/
-- simple-grid.tsx) — for things like an extraction or library name that
-- don't fit the tick-box status model the preset/custom *steps* use.
-- Rendered between the Species column and the step columns.

create table if not exists lab_workflow_custom_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null
);

-- One cell of a custom column: a sample's free-text value in it. Rows are
-- created on demand (first edit), same as lab_workflow_entries.
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

alter table lab_workflow_custom_columns enable row level security;
alter table lab_workflow_custom_values enable row level security;
