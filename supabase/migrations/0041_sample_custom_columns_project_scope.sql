-- Lets a custom sample column be scoped to the project it was created
-- from (CSV import inside a project's Samples tab, or that project's own
-- Manage columns dialog), rather than always being visible on every
-- project the owning account has — see sample-custom-columns-store.ts.
-- Null means what every existing column already is: created from the
-- plain Database page with no project in context, so it keeps showing up
-- everywhere that account's samples do.
alter table sample_custom_columns
  add column if not exists project_id uuid references projects (id) on delete cascade;

create index if not exists sample_custom_columns_project_id_idx
  on sample_custom_columns (project_id);
