-- Fully user-nameable "Other: specify" fields for a collection's own
-- samples — the collection equivalent of sample_custom_columns/values
-- (see 0028_sample_custom_columns.sql), but always scoped to one
-- collection rather than optionally project-scoped: a collection's
-- samples live in their own collection_samples table entirely, so there's
-- no "plain Database page" equivalent for a column to default to. Mirrors
-- lab_workflow_custom_columns/values's single-scope shape instead.

create table if not exists collection_custom_columns (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections (id) on delete cascade,
  created_at timestamptz not null default now(),

  position integer not null,
  label text not null
);

create table if not exists collection_custom_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references collection_custom_columns (id) on delete cascade,
  sample_id uuid not null references collection_samples (id) on delete cascade,
  updated_at timestamptz not null default now(),

  value text,

  unique (column_id, sample_id)
);

create index if not exists collection_custom_columns_collection_id_idx on collection_custom_columns (collection_id);
create index if not exists collection_custom_values_sample_id_idx on collection_custom_values (sample_id);

alter table collection_custom_columns enable row level security;
alter table collection_custom_values enable row level security;
