-- Run this once in the Supabase SQL Editor. Adds:
--   1. The "Lab notes" tab — a titled, dated markdown notebook, same shape
--      as project_bio_notes_blocks (see 0015_project_bio_notes_blocks.sql).
--   2. Image attachments for both notebooks (gel images, traces, etc.) —
--      added via their own button rather than embedded in a markdown
--      block, since they carry their own metadata (title, optional linked
--      samples, optional notes) instead of just living inline in prose.
--      Uses the existing "project-images" storage bucket.

create table if not exists project_lab_notes_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  position integer not null,
  title text not null,
  content text not null default ''
);

create index if not exists project_lab_notes_blocks_project_id_idx on project_lab_notes_blocks (project_id);

alter table project_lab_notes_blocks enable row level security;

create table if not exists project_lab_note_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  title text not null,
  notes text,
  -- Which sample(s) this image relates to — optional, and not a foreign
  -- key: a sample referenced here that's later deleted just stops
  -- resolving to a display name rather than blocking the delete.
  sample_ids uuid[] not null default '{}',
  image_url text not null
);

create index if not exists project_lab_note_images_project_id_idx on project_lab_note_images (project_id);

alter table project_lab_note_images enable row level security;

create table if not exists project_bio_note_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),

  title text not null,
  notes text,
  sample_ids uuid[] not null default '{}',
  image_url text not null
);

create index if not exists project_bio_note_images_project_id_idx on project_bio_note_images (project_id);

alter table project_bio_note_images enable row level security;
