-- Run this once in the Supabase SQL Editor. Bioinformatic workflow: the
-- same shape as Lab Workflow (see 0007_lab_workflows.sql,
-- 0011_lab_workflow_custom_columns.sql, 0012_lab_workflow_detail_columns.sql,
-- 0013_lab_workflow_detail_rows.sql) under its own table names, with a
-- different preset vocabulary (src/lib/bio-workflow-steps.ts,
-- bio-workflow-detail-columns.ts) — a project's Lab and Bioinformatic
-- workflows never share rows, only the same table design.

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

-- Custom, free-text columns on the Simple grid (same role as
-- lab_workflow_custom_columns/values).
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

-- The Detailed view's single, fully customizable table per workflow (same
-- role as lab_workflow_detail_columns/rows/values). Sample ID isn't
-- stored (comes from `samples`); Status (kind = 'status') is seeded by
-- application code (createWorkflow) for every new workflow. One row per
-- attempt at a sample, not one row per sample, so a sample that needs to
-- be redone gets a second (or third, ...) row via "Duplicate row".
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

alter table bio_workflows enable row level security;
alter table bio_workflow_steps enable row level security;
alter table bio_workflow_samples enable row level security;
alter table bio_workflow_entries enable row level security;
alter table bio_workflow_custom_columns enable row level security;
alter table bio_workflow_custom_values enable row level security;
alter table bio_workflow_detail_columns enable row level security;
alter table bio_workflow_detail_rows enable row level security;
alter table bio_workflow_detail_values enable row level security;
