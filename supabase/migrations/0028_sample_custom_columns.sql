-- Fully user-nameable "Other: specify" fields on samples — mirrors
-- lab_workflow_custom_columns/values (every column is user-named, no
-- preset vocabulary), but global rather than scoped to one workflow,
-- since a sample itself isn't scoped that way. Values are attached onto a
-- SampleRecord at read time under the key "custom:<column id>", so they
-- flow through the same add/edit-dialog, table, CSV, and marker-style
-- machinery every preset field already uses.
create table if not exists sample_custom_columns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null
);

create table if not exists sample_custom_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references sample_custom_columns (id) on delete cascade,
  sample_id uuid not null references samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, sample_id)
);

create index if not exists sample_custom_values_sample_id_idx on sample_custom_values (sample_id);

alter table sample_custom_columns enable row level security;
alter table sample_custom_values enable row level security;
