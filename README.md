# Specibase

A sample database and interactive map for evolutionary biology field collections. Built for a single lab first, extensible to collaborators, with per-sample lab-workflow tracking (extraction → library prep → sequencing → analysis) and GBIF occurrence overlays to spot sampling gaps.

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

No existing tool combines: multi-project sample sharing, a full extraction→library→sequencing→analysis pipeline per sample, spreadsheet-native bulk data entry, an interactive map of your own collection, and a GBIF occurrence overlay for gap analysis — in something a single lab can self-host and customize quickly. That combination is what Specibase is for.

## Users and access

- **Owner** (PI / lab manager): full read/write, manages projects and user roles
- **Lab member**: read/write on samples and workflow stages, can create projects
- **Collaborator**: read/write scoped to specific project(s) they're added to, read-only elsewhere (or no visibility, project-dependent)

Auth and row-level permissions are handled by Supabase (see Stack, below), not hand-rolled.

## Data model

### Identity and collection metadata

```
Species
  id, scientific_name, common_name, gbif_taxon_key

Project
  id, name, description, pi, created_at

Sample
  id, primary_identifier (unique, required — the one ID everything else hangs off),
  species_id -> Species,
  latitude, longitude, locality_text, collection_date, collector,
  tissue_type, storage_location,
  metadata (jsonb — holds any extra columns a lab's CSV brings in beyond the fixed fields)

SampleIdentifier   -- the "other possible identifiers" (voucher #, field #, tube barcode, ...)
  id, sample_id -> Sample, identifier_type (e.g. museum_voucher, field_number, tube_barcode),
  value

  -- a sample can have any number of these; a given identifier_type isn't assumed unique
  -- per sample (e.g. a specimen can carry both a field number and a museum voucher number)

SampleProject   -- many-to-many: a sample can serve multiple projects
  sample_id -> Sample, project_id -> Project
```

### Lab workflow (extraction → library → sequencing → analysis)

Each step is its own entity, not just a status flag, because in practice one sample can yield multiple extractions (a first attempt can fail or degrade and get redone), one extraction can yield multiple libraries, and one library can be sequenced more than once (e.g. topped up for more depth). Modeling this as a chain, rather than one row per sample, is what lets "extraction number(s)", "library name", and "sequencing method(s)" all be tracked as the plural, repeatable things they actually are.

```
Extraction
  id, sample_id -> Sample, extraction_number (per-sample sequence: E1, E2, ...),
  batch_id -> ExtractionBatch (nullable),
  method, date, performed_by -> User,
  status (pending / success / degraded / failed),
  notes (freeform — "visible degradation on gel", "low yield, re-extract"),
  metrics (jsonb — concentration, 260/280, etc., optional)

Library
  id, extraction_id -> Extraction, library_name (unique),
  batch_id -> LibraryBatch (nullable),
  prep_method, date, performed_by -> User,
  status, notes

SequencingRun
  id, run_name, platform/method (e.g. Illumina NovaSeq X, ONT MinION), date, performed_by -> User, notes

SequencingLibrary   -- many-to-many: one run pools many libraries; a library can be run more than once
  sequencing_run_id -> SequencingRun, library_id -> Library, status, notes

Analysis
  id, sample_id -> Sample (or library_id, when analysis is run-specific),
  analysis_type, pipeline/method, date, performed_by -> User, status, notes
```

`ExtractionBatch` / `LibraryBatch` group multiple `Extraction`/`Library` rows that were processed together (a plate, a day's bench work) so that method, date, and performed_by can be entered once and applied to many samples — see Batch operations below.

### Method vocabularies

`Extraction.method`, `Library.prep_method`, and `SequencingRun.platform` are free text, but each is backed by a small `Method` lookup table (scoped by stage: extraction / library_prep / sequencing) that the UI uses to autocomplete from methods you've used before (e.g. "Qiagen DNeasy", "Illumina DNA Prep", "NovaSeq X"). This gives consistent values for filtering/reporting without a hard-coded enum that breaks when the lab adopts a new kit.

### Users

```
User
  id, name, email, role (owner / lab_member / collaborator)

ProjectMember   -- scopes collaborator access to specific projects
  user_id -> User, project_id -> Project, permission (view/edit)
```

### GBIF cache

```
GbifOccurrenceCache
  id, species_id -> Species, latitude, longitude, gbif_dataset_key, record_date, fetched_at
```

Cached and refreshed periodically per species, not fetched live on every map render — GBIF's API is rate-limited and occurrence data doesn't change minute-to-minute.

## CSV / spreadsheet workflow

Metadata entry is spreadsheet-first, not form-first, since that's how field data actually arrives:

- **Downloadable empty template**: a "Download template" button generates a CSV with the fixed `Sample` columns (`primary_identifier`, `species`, `latitude`, `longitude`, `locality_text`, `collection_date`, `collector`, `tissue_type`, `storage_location`) plus common identifier columns (`museum_voucher`, `field_number`, ...). Extra columns a lab adds are preserved and land in `Sample.metadata` automatically — the template isn't a hard schema wall.
- **Import**: upload a filled-in CSV, get a preview + validation pass (duplicate `primary_identifier`, unrecognized species, bad lat/lon) before anything commits, then a one-click commit that inserts new samples and flags rows that look like updates to existing ones (matched on `primary_identifier`) for review rather than silently overwriting.
- **Export**: any filtered view (a project, a species, a saved search) exports back to the same CSV shape, so the round trip (export → edit in Excel/Sheets → re-import) works.
- Workflow-stage data (extractions, libraries, sequencing runs) gets its own smaller import templates for the same reason — a sequencing core's run report is a spreadsheet too, and batch-logging 96 extraction results by hand in a web form is not something anyone wants to do.

## Batch operations

Projects need to be batch-modifiable, since lab work happens in batches (a plate of 96 extractions, a project taking on 40 archived samples at once), not one sample at a time. On a project's sample table:

- Multi-select samples (checkboxes, select-all-filtered) and apply a bulk edit: add/remove project membership, update a shared field (e.g. `storage_location` after a freezer move), or bulk-log a workflow stage.
- Bulk-logging a stage creates an `ExtractionBatch`/`LibraryBatch` (or a `SequencingRun` for sequencing) once, with the shared method/date/performed_by, and one `Extraction`/`Library`/`SequencingLibrary` row per selected sample — so a single action can say "these 24 samples were extracted today with method X" while still leaving room for per-sample notes/status if one of them failed.
- Bulk actions are also the natural CSV import path for stage data: import a batch's spreadsheet, it becomes one batch entity plus per-sample rows.

## Architecture / stack

- **Frontend**: React (Vite or Next.js) + [MapLibre GL JS](https://maplibre.org/) for the map — open-source, no vendor API key lock-in the way Mapbox GL requires
- **Backend/DB**: Postgres with the **PostGIS** extension for spatial queries (radius search, bounding-box filters, distance-to-nearest-occurrence for gap analysis), via **[Supabase](https://supabase.com)**
  - Supabase gives Postgres + auth + row-level security (maps directly onto the Owner/Lab member/Collaborator model above) + file storage, without standing up and operating your own server. This is the fastest realistic path to something usable, and self-hosting Postgres yourself is a fallback if you outgrow Supabase's free/pro tier limits, not a day-one requirement.
- **CSV handling**: client-side parsing/validation (e.g. PapaParse) for immediate preview feedback, server-side commit via Supabase functions for the actual insert/update transaction
- **GBIF integration**: a server-side job (Supabase Edge Function or a small scheduled script) queries the [GBIF Occurrence API](https://www.gbif.org/developer/occurrence) per species in your `Species` table, stores results in `GbifOccurrenceCache`, and the map renders them as a separate toggleable layer distinct from your own sample points.
- **Hosting**: frontend on Vercel or Netlify (static + serverless functions), backend on Supabase's managed infrastructure. No servers to patch.

## Roadmap

**Phase 1 — Core data + CSV**
- `Species` / `Project` / `Sample` / `SampleIdentifier` / `SampleProject`
- Downloadable CSV template, import with validation preview, export
- Project sample table with multi-select and batch field edits (add/remove project, bulk field update)
- Auth with the three roles above

**Phase 2 — Lab workflow**
- `Extraction` / `Library` / `SequencingRun` / `SequencingLibrary` / `Analysis`, with `ExtractionBatch`/`LibraryBatch`
- Method autocomplete lookup per stage
- Batch-logging a stage across multiple selected samples
- Per-sample timeline view (all stages, methods, notes, status, in order)

**Phase 3 — Interactive map**
- Map of your own samples, colored/filtered by current stage
- Click a point → metadata + full workflow history popup

**Phase 4 — GBIF overlay + gap analysis**
- Per-species occurrence fetch + cache job
- Toggleable occurrence layer on the map
- Gap view (regions with GBIF records but no lab samples within some radius)

**Phase 5 — Attachments and external links**
- File attachments per sample (photos, chromatograms)
- Linked external accessions (NCBI SRA/BioSample IDs) rather than re-storing sequence data
- Notifications (e.g. "sample stuck at extracted for 90+ days")

**Phase 6 — Collaboration and sharing**
- Fine-grained per-project collaborator invites
- Optional public/read-only view for a project (e.g. for a paper's data availability statement)
- Optional path to publish back to GBIF as an occurrence dataset

## Open questions to resolve before Phase 1 starts

- Fixed `SampleIdentifier` types to ship in the template (museum_voucher, field_number, tube_barcode — what else does the lab actually use?) vs. leaving identifier types fully freeform
- Whether `primary_identifier` follows an existing lab numbering convention that needs validation on entry (format check, sequence gaps flagged, etc.)
- Starting `Method` vocabulary to pre-seed for extraction/library/sequencing, if any, versus starting empty and building it up from usage
- Initial workflow stage/status vocabulary — the pending/success/degraded/failed set above is a starting guess, not fixed
- Data migration: how many existing samples/spreadsheets need to be imported on day one, and in what format(s)
