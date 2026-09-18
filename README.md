# Specibase

Sample database for evolutionary biology field collections. See [PLAN.md](./PLAN.md) for the full design (data model, architecture, roadmap).

## Current state

An early prototype of the first screen: the sample table plus CSV template/import, backed by Supabase/Postgres.

- Required fields: Sample ID, species, latitude, longitude
- Optional fields (tick to show as table columns / include in the CSV template): collection date, country, locality, additional number, collector, tissue type, storage location, notes — add more in `src/lib/fields.ts` (and a matching column in `supabase/schema.sql`)
- CSV import validates rows (required fields, lat/lng range, duplicate Sample ID) before committing anything
- No per-user login yet (Owner/Lab member/Collaborator roles are planned — see PLAN.md); optionally gate the whole site behind one shared password via `APP_PASSWORD` (see below)

## Local setup

1. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's Settings > API. The service role key has full read/write access — keep it out of version control and never expose it to client-side code (nothing in this app does; all Supabase access happens in API routes under `src/app/api/`).
2. In the Supabase SQL Editor, run `supabase/schema.sql` once to create the `samples` table.
3. `npm install && npm run dev`, then open [http://localhost:3000](http://localhost:3000) (redirects to `/samples`).

## Deploying

This repo is set up to deploy on Vercel with zero build config. After importing the repo in Vercel:

1. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` under Project Settings > Environment Variables (same values as `.env.local`).
2. Optionally set `APP_PASSWORD` there too, to require a shared password (any username) before the site loads at all — worthwhile until real per-user auth exists, since without it anyone with the URL can read/write data.
3. Push to `main` — Vercel builds and deploys automatically on every push.

## Learn more

Built with Next.js (App Router) + Tailwind + hand-rolled shadcn-style UI primitives (`ui.shadcn.com` isn't reachable from this dev environment, so components in `src/components/ui/` were written directly rather than pulled via the CLI).
