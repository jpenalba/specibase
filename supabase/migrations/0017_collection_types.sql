-- Run this once in the Supabase SQL Editor. Adds `collections.collection_type`
-- — chosen when a collection is added (src/lib/collection-types.ts) — so
-- the database map's layer panel can group collections into per-type
-- folders (Field/Museum/Collaborator/Other), one child layer per
-- collection inside. Existing rows default to 'other'.

alter table collections add column if not exists collection_type text
  not null default 'other'
  check (collection_type in ('field', 'museum', 'collaborator', 'other'));
