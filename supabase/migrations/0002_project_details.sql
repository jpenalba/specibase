-- Run this once in the Supabase SQL Editor against a database that already
-- has the `projects` table from schema.sql or migration 0001. Adds the
-- fuller project profile shown on the new /projects page — existing rows
-- just get null for all of these until edited.

alter table projects add column if not exists description text;
alter table projects add column if not exists start_date date;
alter table projects add column if not exists owner text;
alter table projects add column if not exists collaborators text;
alter table projects add column if not exists focal_group text;
alter table projects add column if not exists focal_region text;
