-- Run this once in the Supabase SQL Editor. Lets a project's Samples tab
-- map (src/app/projects/[id]/samples) either draw every sample with one
-- flat color/shape, or color/shape samples by a chosen field's value
-- (species, country, etc — see src/lib/fields.ts MARKER_STYLE_FIELDS).
--
-- marker_style_field null means "single style" mode, using marker_color/
-- marker_shape directly (same defaults as today when both are also null).
-- A non-null marker_style_field names one of those fields' keys, and
-- per-value color/shape picks live in project_marker_styles below — a
-- value with no row there just gets an automatically assigned color (see
-- colorForCategoryIndex in src/lib/layer-colors.ts) and the default shape.

alter table projects add column if not exists marker_style_field text;
alter table projects add column if not exists marker_color text;
alter table projects add column if not exists marker_shape text
  check (marker_shape in ('circle', 'square', 'triangle', 'diamond'));

create table if not exists project_marker_styles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Kept alongside field_value (rather than deleting old rows on a field
  -- switch) so switching marker_style_field back and forth doesn't lose
  -- previously-picked colors for the field switched away from.
  field_key text not null,
  field_value text not null,
  color text not null,
  shape text not null default 'circle' check (shape in ('circle', 'square', 'triangle', 'diamond')),

  unique (project_id, field_key, field_value)
);

create index if not exists project_marker_styles_project_id_idx on project_marker_styles (project_id);

alter table project_marker_styles enable row level security;
