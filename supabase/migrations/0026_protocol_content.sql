-- Run this once in the Supabase SQL Editor. Adds the markdown body for
-- protocols built directly in Specibase (source_type = 'built'), plus a
-- "last edited" timestamp — `created_at` already records when the
-- protocol record itself was made, but that's set once and never reflects
-- later content edits.
alter table protocols add column if not exists content text;
alter table protocols add column if not exists updated_at timestamptz not null default now();
