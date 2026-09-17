# Specibase

Sample database for evolutionary biology field collections. See [PLAN.md](./PLAN.md) for the full design (data model, architecture, roadmap).

## Current state

This is an early prototype of the first screen: the sample table plus CSV template/import. It runs against a local JSON file (`data/samples.json`, gitignored) instead of a real database for now — that gets swapped for Supabase/Postgres in a later pass without changing the UI, since all reads/writes go through `src/lib/samples-store.ts`.

- Required fields: Sample ID, species, latitude, longitude
- Optional fields (tick to show as table columns / include in the CSV template): collection date, country, locality, additional number, collector, tissue type, storage location, notes — add more in `src/lib/fields.ts`
- CSV import validates rows (required fields, lat/lng range, duplicate Sample ID) before committing anything

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/samples`.

## Learn more

Built with Next.js (App Router) + Tailwind + hand-rolled shadcn-style UI primitives (`ui.shadcn.com` isn't reachable from this dev environment, so components in `src/components/ui/` were written directly rather than pulled via the CLI).
