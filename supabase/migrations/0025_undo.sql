-- Run this once in the Supabase SQL Editor. Adds soft-delete to samples
-- and collection_samples, and extends activity_log so a recent delete or
-- bulk import can be undone from the Logs page.
--
-- Soft-deleting (instead of a real SQL delete) matters beyond just undo:
-- samples cascade-deletes into a lot of workflow history (lab/bio workflow
-- entries, detail rows, custom values, sample_projects links, ...) via
-- `on delete cascade`. A real delete destroys all of that permanently the
-- instant someone clicks delete. Soft-deleting means that history is never
-- actually touched — it just becomes invisible until (and unless) the
-- sample is restored, at which point it's all still there.
--
-- Deleted rows keep their primary_identifier reserved (existingIdentifiers
-- doesn't filter deleted_at) — reusing an ID that might still come back
-- via undo would make undo ambiguous about which row it's restoring.
-- There's no automatic purge of old soft-deleted rows yet; see
-- ARCHIVING_PLAN.md for the eventual bigger-picture retention story.

alter table samples add column if not exists deleted_at timestamptz;
alter table collection_samples add column if not exists deleted_at timestamptz;

-- undo_data is null for anything that isn't undoable (most log entries —
-- e.g. a project rename). When present, it's a small tagged object like
-- {"kind": "restore_sample", "sampleId": "..."} that
-- /api/activity-log/[id]/undo knows how to reverse. undone_at marks an
-- entry that's already been undone, so its Undo button disappears rather
-- than being clickable twice.
alter table activity_log add column if not exists undo_data jsonb;
alter table activity_log add column if not exists undone_at timestamptz;
