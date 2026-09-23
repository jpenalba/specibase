-- Run this once in the Supabase SQL Editor. Adds the `protocols` table for
-- the new Protocols page (src/app/protocols) — field/lab/bioinformatic/
-- other protocols, each either an uploaded PDF or (eventually) built
-- directly in Specibase. source_type records which, though the in-app
-- builder itself isn't designed yet — a "built" protocol just has no PDF
-- for now.
--
-- `protocol-files`: a public Storage bucket for uploaded PDFs, same
-- reasoning as `project-images` (see 0008_project_background.sql) — no
-- per-user auth yet, so a public file URL isn't a new exposure.

create table if not exists protocols (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  description text,
  date_added date not null default current_date,
  protocol_type text not null default 'other'
    check (protocol_type in ('field', 'lab', 'bioinformatic', 'other')),
  source_type text not null check (source_type in ('pdf', 'built')),
  pdf_url text,
  pdf_filename text
);

alter table protocols enable row level security;

insert into storage.buckets (id, name, public)
values ('protocol-files', 'protocol-files', true)
on conflict (id) do nothing;
