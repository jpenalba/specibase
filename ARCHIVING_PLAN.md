# Automatic archiving — design plan

Not implemented — this is a design doc to revisit later. When it came up, the immediate, smaller need (recovering from one accidental delete or bad import) got solved instead by an **Undo** feature (per-action, built directly into the activity log — see `src/lib/activity-log.ts` and the Logs page). This doc is for the bigger, blunter tool Undo doesn't replace: rolling the *entire* database back to a point in time, for damage Undo can't reach (an update nobody thought to log, several unrelated bad changes compounding, or just wanting a periodic safety net independent of catching each mistake individually).

## What it's for

A scheduled, automatic snapshot of the whole database, with the last 3 kept, so that if something goes wrong in a way too broad or too late-noticed for Undo to fix, everything can be rolled back to a known-good point. The user picks the cadence: daily, weekly, or monthly.

## Mechanism: Postgres-native schema snapshots

Rather than exporting rows through the Next.js API layer (slow for a large database, and restoring needs careful foreign-key ordering), do it inside Postgres itself:

- A SQL function, e.g. `run_archive_if_due()`, that:
  1. Checks `app_settings` for the configured frequency and the timestamp of the last archive; does nothing if not due yet.
  2. Rotates three schemas: drops `archive_3`, renames `archive_2` → `archive_3`, `archive_1` → `archive_2`, creates a fresh `archive_1`.
  3. For every table in `public` (enumerated dynamically via `information_schema.tables`, so new tables from future migrations are picked up automatically without editing this function again), runs `create table archive_1.<name> as select * from public.<name>`.
  4. Updates `last_archived_at`.
- **Restoring** from `archive_N` is the mirror image: inside one transaction, truncate every live table and repopulate it from that archive schema.

This reuses Postgres's own bulk-copy machinery — fast, atomic, and nothing ever leaves the database (no export files, no new storage bucket).

## Scheduling

Supabase supports `pg_cron` as an extension. Schedule the check function to run once a day inside Postgres itself:

```sql
select cron.schedule('archive-check', '0 3 * * *', 'select run_archive_if_due()');
```

The function itself decides whether "today" is actually due, based on the stored frequency — so the user's daily/weekly/monthly choice is just a row in `app_settings`, not a redeployed cron config, and the whole feature lives inside Supabase with no dependency on wherever the Next.js app is hosted.

**To verify before building**: confirm `pg_cron` is enabled (or enable-able) on the actual Supabase plan in use — it's usually a simple extension toggle, but hasn't been checked against this project specifically.

## Where it would live

- A migration adding the `run_archive_if_due()` / restore function(s), and extending `app_settings` with `archive_frequency` (`'daily' | 'weekly' | 'monthly'`, nullable — null means off) and `last_archived_at`.
- A thin store file (e.g. `src/lib/archives-store.ts`) wrapping a few RPC calls: list the 3 archives (with their timestamps), restore a given one, trigger one manually ("Archive now"), get/set the frequency.
- API routes: `GET/POST /api/archives`, `POST /api/archives/[schema]/restore`, `GET/PATCH /api/archives/settings`.
- UI: a section on the **Logs page**, alongside the activity feed — same "history of the account" spirit, just the all-or-nothing version of it.

## The tradeoff to keep in view

Restoring is whole-database and all-or-nothing. If someone accidentally deletes a batch of samples today, restoring to last week's archive undoes that — but also every legitimate edit anyone made across every project in between. Given the finest interval is daily, that's a real cost to accept knowingly. The restore action needs a hard confirmation (type a phrase to confirm, not just an "are you sure" dialog) given how destructive it is to everything made since the chosen snapshot.

## Relationship to Undo

Undo (built) handles the common, narrow case well: one delete, one bad import, undone within the activity log, with no collateral damage to anything else. Archiving (this doc) handles the case Undo structurally can't: damage from actions that were never logged as undoable (edits), or a general "something's wrong and I don't know exactly what, take me back to Tuesday" need. They're complementary, not redundant — build this when that second kind of need actually shows up, not preemptively.
