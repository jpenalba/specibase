-- Whether a project's Samples-tab map hides samples with no value for the
-- chosen marker-style field, rather than always showing them in the
-- "(No value)" bucket. Only meaningful when marker_style_field is set.
alter table projects
  add column if not exists marker_hide_no_value boolean not null default false;
