-- Phase 4 of AUTH_AND_PERMISSIONS_PLAN.md: per-user + per-project activity
-- log attribution. Replaces the single pre-auth "is logging on" switch
-- (app_settings.activity_logging_enabled) with two independent ones: each
-- account's own profiles.log_enabled (already added by 0031_profiles.sql,
-- unused until now), and a new per-project switch each project's Owner(s)
-- control. activity_log gains a real user_id FK alongside its existing
-- denormalized performed_by text snapshot, so a signed-in account's own
-- cross-project activity can actually be queried rather than only
-- displayed.
alter table activity_log add column if not exists user_id uuid references profiles (id) on delete set null;

alter table projects add column if not exists log_enabled boolean not null default true;

-- Fully superseded by profiles.log_enabled + projects.log_enabled — see
-- above. No app code reads or writes this table any more.
drop table if exists app_settings;
