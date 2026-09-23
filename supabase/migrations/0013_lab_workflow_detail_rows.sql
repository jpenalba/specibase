-- Run this once in the Supabase SQL Editor, after 0012. Lets a sample
-- appear more than once in the Detailed view — a "redo" row for a sample
-- that needs to be run again (src/components/lab-workflow/detail-table.tsx)
-- — by introducing a row per attempt instead of one row per sample.

create table if not exists lab_workflow_detail_rows (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references lab_workflows (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- 1 for the row a sample gets automatically on enrollment; 2, 3, ... for
  -- each duplicate ("redo") of it, in creation order.
  attempt_number integer not null default 1,

  unique (workflow_id, sample_id, attempt_number)
);

create index if not exists lab_workflow_detail_rows_workflow_id_idx on lab_workflow_detail_rows (workflow_id);
create index if not exists lab_workflow_detail_rows_sample_id_idx on lab_workflow_detail_rows (sample_id);

alter table lab_workflow_detail_rows enable row level security;

-- One attempt-1 row for every sample already enrolled in a workflow (new
-- enrollments get theirs from application code — see enrollSamples in
-- src/lib/lab-workflows-store.ts).
insert into lab_workflow_detail_rows (workflow_id, sample_id, attempt_number)
select ws.workflow_id, ws.sample_id, 1
from lab_workflow_samples ws
where not exists (
  select 1 from lab_workflow_detail_rows r
  where r.workflow_id = ws.workflow_id and r.sample_id = ws.sample_id
);

-- Re-point existing detail values at the attempt-1 row instead of the
-- sample directly, then drop the now-redundant sample_id column. Gated on
-- sample_id still existing so re-running this migration after it already
-- succeeded is a no-op instead of failing on a column that's already gone.
alter table lab_workflow_detail_values
  add column if not exists row_id uuid references lab_workflow_detail_rows (id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'lab_workflow_detail_values' and column_name = 'sample_id'
  ) then
    update lab_workflow_detail_values v
    set row_id = r.id
    from lab_workflow_detail_columns c, lab_workflow_detail_rows r
    where v.column_id = c.id
      and r.workflow_id = c.workflow_id
      and r.sample_id = v.sample_id
      and r.attempt_number = 1
      and v.row_id is null;

    -- A value with no matching row would be a value for a sample that was
    -- never actually enrolled, which shouldn't be reachable through the
    -- app — drop it rather than leave an unusable null row_id behind.
    delete from lab_workflow_detail_values where row_id is null;

    alter table lab_workflow_detail_values alter column row_id set not null;
    alter table lab_workflow_detail_values drop constraint if exists lab_workflow_detail_values_column_id_sample_id_key;
    alter table lab_workflow_detail_values drop column sample_id;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'lab_workflow_detail_values_column_id_row_id_key'
  ) then
    alter table lab_workflow_detail_values
      add constraint lab_workflow_detail_values_column_id_row_id_key unique (column_id, row_id);
  end if;
end $$;

create index if not exists lab_workflow_detail_values_row_id_idx on lab_workflow_detail_values (row_id);
