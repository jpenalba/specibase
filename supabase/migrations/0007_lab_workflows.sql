-- Lab Workflow: a project can have any number of customizable workflows
-- (e.g. one for a ddRAD sample subset, another for whole-genome samples),
-- each a sequence of steps (extraction, PCR, sequencing, ...) tracked per
-- enrolled sample. See PLAN.md's "Lab workflow" section for the original
-- fixed-pipeline sketch this generalizes into a lab-configurable one.

create table if not exists lab_workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed'))
);

-- One workflow's ordered steps. `step_key` is a preset from
-- src/lib/lab-workflow-steps.ts, or 'custom' for a lab-named one — `label`
-- is what's actually displayed (the preset's own label, or the lab's text
-- for a custom step), so renaming a custom step never touches step_key.
create table if not exists lab_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  step_key text not null,
  label text not null
);

-- Which of the project's samples are enrolled in this particular workflow
-- — hand-picked per workflow, not automatically every project sample,
-- since two workflows on one project can track different sample subsets.
create table if not exists lab_workflow_samples (
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (workflow_id, sample_id)
);

-- One cell of the grid: a sample's progress on one step. `status` alone
-- drives the Simple grid view; the rest (method/date/performed_by/
-- quantification/notes) is what the Detailed spreadsheet view edits.
-- Rows are created on demand (first status change) rather than
-- pre-inserted for every sample x step pair.
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
  -- Free-form per-step metrics (e.g. {"concentration": 45.2, "unit": "ng/µL"})
  -- since what's worth quantifying differs by step.
  quantification jsonb,
  notes text,

  unique (step_id, sample_id)
);

create index if not exists lab_workflow_steps_workflow_id_idx on lab_workflow_steps (workflow_id);
create index if not exists lab_workflow_samples_sample_id_idx on lab_workflow_samples (sample_id);
create index if not exists lab_workflow_entries_sample_id_idx on lab_workflow_entries (sample_id);

alter table lab_workflows enable row level security;
alter table lab_workflow_steps enable row level security;
alter table lab_workflow_samples enable row level security;
alter table lab_workflow_entries enable row level security;
