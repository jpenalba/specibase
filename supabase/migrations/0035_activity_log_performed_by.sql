-- Attributes each new log entry to whoever did it — a denormalized
-- snapshot (their username, or email if they haven't set one) taken at
-- the moment of the action, same "precomputed, not joined" approach the
-- rest of activity_log already uses (see 0024_activity_log.sql). Existing
-- entries stay unattributed, same reasoning as every other nullable
-- backfill in this app: they predate the concept.
alter table activity_log add column if not exists performed_by text;
