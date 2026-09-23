-- Run this once in the Supabase SQL Editor. The "Bioinformatic notes" tab:
-- a notebook of titled, dated markdown blocks (not one big text field like
-- Background/Notes on the Info tab) — the lab adds a new dated entry per
-- session rather than editing one running document.

create table if not exists project_bio_notes_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Insertion-order counter, same convention as lab_workflow_steps.position
  -- — reordering rewrites every affected row's position rather than using
  -- e.g. a linked list.
  position integer not null,
  title text not null,
  content text not null default ''
);

create index if not exists project_bio_notes_blocks_project_id_idx on project_bio_notes_blocks (project_id);

alter table project_bio_notes_blocks enable row level security;
