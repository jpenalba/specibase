-- The free-text owner/collaborators columns predate project_members (see
-- 0036_project_members.sql), which is now the real source of truth for who
-- owns and who's on a project. Keeping both around invited them to drift
-- apart, so the free-text pair is dropped — every reader now goes through
-- project_members/profiles instead (src/lib/project-members-store.ts).
alter table projects drop column if exists owner;
alter table projects drop column if exists collaborators;
