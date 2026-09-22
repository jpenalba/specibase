-- Run this once in the Supabase SQL Editor. Adds `project_references` —
-- the References section of a project's Info tab
-- (src/app/projects/[id]/info). A reference is either found via a
-- Crossref title search (doi + source populated, citation formatted
-- server-side — see src/lib/apa-format.ts) or pasted in by hand (doi and
-- source left null, citation stored exactly as typed).

create table if not exists project_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- The APA-formatted (or hand-pasted) string actually shown.
  citation text not null,
  -- Lowercased first-author surname for a Crossref-sourced entry, or the
  -- citation's own leading text for a manual one — either way, sorting
  -- by this column alone reproduces APA's "alphabetical by first author"
  -- reference-list order without needing structured author data for
  -- manual entries.
  sort_key text not null,
  doi text,
  -- Raw Crossref metadata behind a searched entry, kept for provenance —
  -- null for a manual entry.
  source jsonb
);

create index if not exists project_references_project_id_idx on project_references (project_id);

alter table project_references enable row level security;
