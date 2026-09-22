-- Run this once in the Supabase SQL Editor. Adds `projects.notes` — a
-- second, separate free-form markdown field alongside `background`
-- (see 0008_project_background.sql), rendered in its own section of the
-- project's Info tab (src/app/projects/[id]/info). Null means nothing's
-- been written yet, same convention as `background`.

alter table projects add column if not exists notes text;
