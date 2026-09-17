# Specibase

A sample database and interactive map for evolutionary biology field collections. Built for a single lab first, extensible to collaborators, with per-sample workflow tracking (extracted / sequenced / analyzed / ...) and GBIF occurrence overlays to spot sampling gaps.

This document is the working plan: problem statement, prior art, architecture, data model, and a phased roadmap. Nothing here is implemented yet — this is the design to review before writing code.

## Problem

Field collections in evolutionary biology labs are usually tracked across a spreadsheet (metadata), a freezer log (storage location), a sequencing core's LIMS (extraction/library/sequencing status), and someone's memory (which project each tissue sample supports, and where geographically the lab still needs coverage for a given species). None of these views talk to each other, and none of them are a map.

Specibase is meant to be the single source of truth for "what samples do we have, where did they come from, what's been done to them, and what projects use them" — with a map as the primary way to browse and audit that.

## Prior art (why build custom)

| Tool | Strength | Why it doesn't fit here |
|---|---|---|
| [Arctos](https://arctosdb.org) | Multi-institution natural history collection management, tissue/DNA tracking, geolocation | Built for museum consortia governance; heavy to stand up and operate for one lab |
| [GGBN Data Portal](https://www.ggbn.org) | Genomic sample tracking (extraction/sequencing status) federated across biobanks | A federation layer over existing institutional collections, not a lab's daily tool |
| [Specify 7](https://www.specifysoftware.org) / [Symbiota2](https://symbiota2.org) | Natural history collection management, GIS mapping | Museum/herbarium data model, not built around molecular workflow stages |
| [iSamples](https://isamples.org) | Persistent identifiers + rich metadata schema for physical samples | A metadata standard/registry, not an app with a map UI |
| LabKey / Benchling / SampleDB | LIMS-style extraction → sequencing → analysis pipelines | No geospatial or species-distribution component |
| [BioCollect](https://biocollect.ala.org.au) (Atlas of Living Australia) | Field data collection with mapping | Built for citizen-science field surveys, not lab sample lifecycle management |

No existing tool combines: multi-project sample sharing, a workflow pipeline per sample, an interactive map of your own collection, and a GBIF occurrence overlay for gap analysis — in something a single lab can self-host and customize quickly. That combination is what Specibase is for.

## Users and access

- **Owner** (PI / lab manager): full read/write, manages projects and user roles
- **Lab member**: read/write on samples and workflow stages, can create projects
- **Collaborator**: read/write scoped to specific project(s) they're added to, read-only elsewhere (or no visibility, project-dependent)

Auth and row-level permissions are handled by Supabase (see Stack, below), not hand-rolled.

## Data model

```
Species
  id, scientific_name, common_name, gbif_taxon_key

Project
  id, name, description, pi, created_at

Sample
  id, catalog_number (unique, lab-assigned), species_id -> Species,
  latitude, longitude, locality_text, collection_date, collector,
  tissue_type, storage_location, metadata (jsonb, freeform/extensible fields)

SampleProject   -- many-to-many: a sample can serve multiple projects
  sample_id -> Sample, project_id -> Project

SampleStage     -- append-only history, not a single status field
  id, sample_id -> Sample, stage (enum: collected/extracted/sequenced/analyzed/published),
  status (enum: pending/in_progress/done/failed), date, performed_by -> User, notes

User
  id, name, email, role (owner/lab_member/collaborator)

ProjectMember   -- scopes collaborator access to specific projects
  user_id -> User, project_id -> Project, permission (view/edit)

GbifOccurrenceCache   -- cached, not live-fetched per page load
  id, species_id -> Species, latitude, longitude, gbif_dataset_key,
  record_date, fetched_at
```

Key decisions:
- **Samples ↔ Projects is many-to-many** via a join table, since a single tissue sample routinely supports more than one project.
- **Workflow status is a history table, not a status column.** A sample's current stage is derivable (latest row per sample), but keeping history gives you an audit trail (who extracted it, when, did it fail and get redone) for free.
- **`metadata` is a JSONB catch-all** on `Sample` for the fields that vary by taxon or project (e.g. sex, age class, voucher number) without needing schema migrations for every new field a collaborator wants.
- **GBIF occurrences are cached locally**, refreshed periodically per species, not fetched live on every map render — GBIF's API is rate-limited and occurrence data doesn't change minute-to-minute.

## Architecture / stack

- **Frontend**: React (Vite or Next.js) + [MapLibre GL JS](https://maplibre.org/) for the map — open-source, no vendor API key lock-in the way Mapbox GL requires
- **Backend/DB**: Postgres with the **PostGIS** extension for spatial queries (radius search, bounding-box filters, distance-to-nearest-occurrence for gap analysis), via **[Supabase](https://supabase.com)**
  - Supabase gives Postgres + auth + row-level security (maps directly onto the Owner/Lab member/Collaborator model above) + file storage, without standing up and operating your own server. This is the fastest realistic path to something usable, and self-hosting Postgres yourself is a fallback if you outgrow Supabase's free/pro tier limits, not a day-one requirement.
- **GBIF integration**: a server-side job (Supabase Edge Function or a small scheduled script) queries the [GBIF Occurrence API](https://www.gbif.org/developer/occurrence) per species in your `Species` table, stores results in `GbifOccurrenceCache`, and the map renders them as a separate toggleable layer distinct from your own sample points.
- **Hosting**: frontend on Vercel or Netlify (static + serverless functions), backend on Supabase's managed infrastructure. No servers to patch.

## Roadmap

**Phase 1 — MVP**
- Sample CRUD (manual entry first; see Phase 3 for bulk import)
- Project tagging (many-to-many)
- Map of your own samples, colored/filtered by current workflow stage
- Auth with the three roles above

**Phase 2 — GBIF overlay**
- Per-species occurrence fetch + cache job
- Toggleable occurrence layer on the map
- Basic gap view (e.g. highlight regions with GBIF records but no lab samples within some radius)

**Phase 3 — Workflow depth + data ops**
- Full `SampleStage` history UI (timeline per sample, not just current status)
- CSV/Excel bulk import and export
- Search/filter by species, project, stage, date range, locality

**Phase 4 — Attachments and external links**
- File attachments per sample (photos, chromatograms)
- Linked external accessions (NCBI SRA/BioSample IDs) rather than re-storing sequence data
- Notifications (e.g. "sample stuck in extracted for 90+ days")

**Phase 5 — Collaboration and sharing**
- Fine-grained per-project collaborator invites
- Optional public/read-only view for a project (e.g. for a paper's data availability statement)
- Optional path to publish back to GBIF as an occurrence dataset

## Open questions to resolve before Phase 1 starts

- Exact field list for `metadata` JSONB — worth surveying what your current spreadsheet(s) track so nothing gets lost in migration
- Whether catalog numbers follow an existing lab numbering convention that needs to be preserved/validated on entry
- Initial set of workflow stages — the list above (collected/extracted/sequenced/analyzed/published) is a starting guess, not fixed
- Data migration: how many existing samples/spreadsheets need to be imported on day one, and in what format
