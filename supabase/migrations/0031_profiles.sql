-- One row per Supabase Auth user — auth.users holds credentials and is
-- never touched directly; this is the public-schema mirror everything
-- else will join against as the auth build progresses (see
-- AUTH_AND_PERMISSIONS_PLAN.md). No account_type: every account is the
-- same kind of account, with a private Database/Collections/Protocols
-- and whatever projects it owns or has been added to.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  -- The personal "log my activity" switch from the auth plan's Logs
  -- design — not used yet (activity_log has no user_id column until a
  -- later phase), but created alongside the rest of the profile row so
  -- there's nothing to backfill onto existing accounts later.
  log_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-creates a profile row the moment a new auth.users row appears
-- (sign-up, invite acceptance, or an account added directly from the
-- Supabase dashboard) — the app never has to remember to do this itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
