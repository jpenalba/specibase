-- Run this once in the Supabase SQL Editor. Adds:
-- - `projects.background`: free-form markdown text for the project's
--   Background tab (src/app/projects/[id]/background). Null means no
--   background has been written yet — the tab shows an "Add background"
--   button rather than empty rendered markdown.
-- - `project-images`: a public Storage bucket for images inserted into
--   that markdown (src/app/api/projects/[id]/background/images). Public
--   because the app has no per-user auth yet — anyone who can already
--   reach the (optionally password-gated) site can already read every
--   sample and project in the database, so a public image URL isn't a
--   new exposure. Revisit if/when real per-user permissions land.

alter table projects add column if not exists background text;

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;
