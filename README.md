# Specibase

Sample database for evolutionary biology field collections. See [PLAN.md](./PLAN.md) for the full design (data model, architecture, roadmap).

## Current state

An early prototype with two pages, backed by Supabase/Postgres:

- **`/samples`** — a **staging area**, not a live view of the database. Add Sample and Import CSV both stage rows locally in the browser first, and nothing reaches the database until you click Upload at the bottom of the page.
- **`/database`** — browse what's actually in the database: a map (top) with a right-hand layer panel and a table (bottom). "Main database" is always the root layer (every sample); each project is a nested child layer scoped to its linked samples. Ticking a layer's checkbox shows/hides its points on the map (multiple layers can be visible at once, each in its own color); clicking a layer's name makes it "active," which is what the bottom table shows. Only samples with coordinates get a map point — a sample identified by locality alone still shows up in the table. The map uses OpenStreetMap's free raster tiles with no API key, which is fine for prototyping but not meant for heavy production traffic — swap in MapTiler/Stadia/Mapbox with a real key (`src/components/database/sample-map.tsx`) if this gets real day-to-day use.

Shared behavior:

- Required fields: Sample ID, species
- Location: either latitude & longitude, or a locality, is required — not each field individually. All three are always shown together (not part of the optional-field toggle), since hiding all three would make the requirement impossible to satisfy.
- Optional fields (tick to show as table columns / include in the CSV template): collection date, country, additional number, collector, tissue type, storage location, notes — add more in `src/lib/fields.ts` (and a matching column in `supabase/schema.sql`)
- Dates are entered/validated as DD-MM-YYYY, stored as ISO internally (`src/lib/dates.ts`)
- Staging validates rows (required fields, the location rule above, lat/lng range, duplicate Sample ID) before they're even staged; the server independently re-validates the whole batch at upload time, since staged state only lives in the browser
- Duplicate Sample IDs (within a batch or against the database) block the entire upload rather than being silently skipped
- At upload time, the batch can optionally be associated with a project (existing or newly named) — a minimal `projects` table for now, ahead of the fuller project model in PLAN.md
- No per-user login yet (Owner/Lab member/Collaborator roles are planned — see PLAN.md); optionally gate the whole site behind one shared password via `APP_PASSWORD` (see below)

## Local setup

1. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's Settings > API. The service role key has full read/write access — keep it out of version control and never expose it to client-side code (nothing in this app does; all Supabase access happens in API routes under `src/app/api/`).
2. In the Supabase SQL Editor: a brand new project runs `supabase/schema.sql` once; a project that already has the `samples` table from an earlier version instead runs `supabase/migrations/0001_optional_location_and_projects.sql`, which updates it in place (makes latitude/longitude nullable, adds the location check, adds `projects`/`sample_projects`) without touching existing rows.
3. `npm install && npm run dev`, then open [http://localhost:3000](http://localhost:3000) (redirects to `/samples`).

## Deploying

This repo is set up to deploy on Vercel with zero build config. After importing the repo in Vercel:

1. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` under Project Settings > Environment Variables (same values as `.env.local`).
2. Optionally set `APP_PASSWORD` there too, to require a shared password (any username) before the site loads at all — worthwhile until real per-user auth exists, since without it anyone with the URL can read/write data.
3. Push to `main` — Vercel builds and deploys automatically on every push.

## Learn more

Built with Next.js (App Router) + Tailwind + hand-rolled shadcn-style UI primitives (`ui.shadcn.com` isn't reachable from this dev environment, so components in `src/components/ui/` were written directly rather than pulled via the CLI).
