-- Run this once in the Supabase SQL Editor. Replaces the old per-step
-- "Detailed view" spreadsheet with a single, fully customizable detail
-- table per workflow (src/components/lab-workflow/detail-table.tsx).
-- Every row is a sample; the only fixed columns are Sample ID (not
-- stored — comes from `samples`) and Status (`kind = 'status'`, seeded
-- below for every workflow). Everything else is a column the lab builds
-- itself, picked from a preset list or fully custom
-- (src/lib/lab-workflow-detail-columns.ts).

create table if not exists lab_workflow_detail_columns (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null,
  kind text not null default 'text' check (kind in ('text', 'date', 'status'))
);

-- One cell of a detail column: a sample's value in it. Rows are created
-- on demand (first edit), same as lab_workflow_custom_values.
create table if not exists lab_workflow_detail_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references lab_workflow_detail_columns (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, sample_id)
);

create index if not exists lab_workflow_detail_columns_workflow_id_idx on lab_workflow_detail_columns (workflow_id);
create index if not exists lab_workflow_detail_values_sample_id_idx on lab_workflow_detail_values (sample_id);

alter table lab_workflow_detail_columns enable row level security;
alter table lab_workflow_detail_values enable row level security;

-- New workflows get their Status column from application code
-- (createWorkflow in src/lib/lab-workflows-store.ts); backfill it here for
-- workflows that already existed before this migration.
insert into lab_workflow_detail_columns (workflow_id, position, label, kind)
select id, 0, 'Status', 'status'
from lab_workflows w
where not exists (
  select 1 from lab_workflow_detail_columns c
  where c.workflow_id = w.id and c.kind = 'status'
);
