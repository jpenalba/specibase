# Specibase

A sample database and interactive map for evolutionary biology field collections. Built for a single lab first, extensible to collaborators, with per-sample lab-workflow tracking (extraction → library prep → sequencing → analysis) and GBIF occurrence overlays to spot sampling gaps.

## Status

This document was originally written before any code existed. The app has since shipped through several rounds of feature work and diverged from that original design in a few deliberate ways — most notably, no auth yet, and a generic user-defined workflow system instead of fixed extraction/library/sequencing entities. This revision replaces the original data model and roadmap with what's actually built, explains where and why it diverged, and reviews the remaining gaps for whether they're still worth building given how the app actually turned out.

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

## What's built

### Core building blocks

- **Projects** — the central hub. Each has an Info tab (markdown background + notes, image uploads), a Samples tab (map + table, its own marker styling), a Lab Workflow tab, a Bioinformatics tab, a Bio Notes tab (block-based notebook), and a References tab (Crossref-backed APA citation list). `owner`/`collaborators` are free-text fields, not real user accounts — see [Users and access](#users-and-access-not-built) below.
- **Samples** — one flat table (`samples`), not a normalized `Species`/`SampleIdentifier` model. Required: `primary_identifier`, `species` (free text, no format lock-in). Location: lat/lon or a locality (at least one required). Everything else — `subspecies`, `genus`/`family`/`taxon_order`/`taxon_class`, `collection_date`, `country`, `additional_number`, `collector`, `tissue_type`, `storage_location`, `notes` — is an opt-in column toggled per-view via a Field Picker (`src/lib/fields.ts`), which also drives the CSV template and the map's marker-styling options automatically.
- **GBIF-assisted taxonomy** — `species` stays free text (so undescribed species/morphospecies codes always save), but an autocomplete against GBIF's `species/suggest` + `species/match` fills in genus/family/order/class when a name resolves. Bulk CSV import resolves once per distinct species in the batch; a manual "Backfill taxonomy from GBIF" button on the Database page does the same for pre-existing samples.
- **Collections** — a parallel `collection_samples` table for external sample sets (field/museum/collaborator/other) that aren't part of the main database yet. Each collection is its own map layer, grouped into a type folder; one click copies a collection's samples into the main database (keeping the collection's own record too).
- **Protocols** — field/lab/bioinformatic/other protocols, shown as a long vertical list (not a card grid). Content is either an uploaded PDF or "Build in Specibase" — the latter currently just saves the protocol's metadata, since the in-app builder itself hasn't been designed.
- **Database map** — the main samples layer, every collection's layer, a GBIF occurrence-density overlay (live tiles, not cached — see below), and saved per-species GBIF range layers. A project's own Samples tab has its own map with per-project marker color/shape, either fixed or mapped by any text field's value (species, genus, a custom column, etc.).
- **CSV workflow** — downloadable template (scoped to whichever optional columns are selected), staged-preview import with row-level validation, and CSV export of whatever's currently visible. A duplicate `primary_identifier` on import currently blocks the whole batch rather than being flagged for review (see gap #1 below).
- **Lab Workflow / Bioinformatic Workflow** — a generic, user-defined step system rather than fixed `Extraction`/`Library`/`SequencingRun`/`Analysis` entities (see [Where this diverged](#where-this-diverged-from-the-original-design) below). Each workflow has its own ordered steps; a Simple grid view for drag-paint status marking, and a fully customizable Detailed table (preset + custom columns, multiple rows per sample, duplicate/redo row actions, an Excel-style fill handle for repeated values), both gated behind an explicit Editing mode.
- **Exports** — CSV for samples and any Detailed workflow table; PDF for the Info tab and Bio Notes tab; a whole-project PDF compiler that lets you pick which sections to include and portrait/landscape per workflow table, with the Samples map captured as an image.
- **Marker styling** — a validated categorical palette (contrast- and colorblind-checked) plus a shape set, usable per-layer or per-category-value.

### Architecture (as built, not as planned)

- **Frontend**: Next.js (App Router) + MapLibre GL JS.
- **Backend/DB**: Supabase Postgres, accessed only server-side via the service-role key (`src/lib/supabase.ts`) — no client-side Supabase calls, no Supabase Auth, no PostGIS. Row-level security is enabled on every table with zero policies, which is what actually keeps the anon key harmless if one's ever introduced by mistake; it's not an access-control layer for real users.
- **Migrations**: plain `.sql` files under `supabase/migrations/`, pasted into the Supabase SQL Editor by hand — there's no migration runner, and `supabase/schema.sql` is kept in sync by hand as the from-scratch equivalent.
- **GBIF integration**: two independent uses, neither involving a local cache table. (1) Occurrence overlay — GBIF's own hex-bin density tiles, fetched live by the browser the same way basemap tiles are, so there's no occurrence data to store or refresh. (2) Taxonomy — `species/suggest` (typeahead) and `species/match` (classification), called through this app's own API routes so the browser never talks to GBIF directly.
- **Storage**: three public Supabase Storage buckets (`project-images`, `protocol-files`, plus the background-image bucket) — public because there's no per-user auth yet, so a public file URL isn't a new exposure beyond what the open API routes already expose.
- **PDF/exports**: `jspdf` + `jspdf-autotable` for compiled PDFs, `react-markdown` for rendering the Info/Bio Notes/Protocols markdown content.
- **Testing**: no automated test suite; verification is `tsc --noEmit` + `next lint` + `next build` plus ad hoc Playwright smoke tests per feature (there's no CI wiring for these — they're run manually during development).

## Where this diverged from the original design

- **`Species` table → free text + denormalized taxonomy columns.** A normalized `Species` entity with `gbif_taxon_key` was the original plan. What shipped instead keeps `species` as a plain string on `samples`/`collection_samples`, with `genus`/`family`/`taxon_order`/`taxon_class` as their own flat columns, auto-filled from GBIF on a best-effort basis. This trades away de-duplication (the same species name typed slightly differently across samples won't self-correct) for zero migration risk on existing free-text data and for fitting the rest of the app's all-flat-columns convention. Worth revisiting only if species-level analytics (e.g. "every sample of species X across every project") become a real need — right now nothing queries by species beyond simple filtering.
- **Fixed `Extraction`/`Library`/`SequencingRun`/`Analysis` chain → generic Lab/Bioinformatic Workflow.** The original plan modeled a specific molecular pipeline as first-class entities. What shipped is a generic per-project "workflow" (ordered steps, a Simple grid, and a fully custom Detailed table) that a lab configures for whatever their actual pipeline is — not just extraction/library/sequencing, and reusable as-is for bioinformatic analysis steps. This is strictly more flexible for a single, evolving lab, at the cost of not having purpose-built fields like "extraction number" or a `Method` lookup with autocomplete (see gap #8).
- **`GbifOccurrenceCache` + scheduled fetch job → live density tiles.** The plan called for periodically fetching and caching raw occurrence points per species. What shipped renders GBIF's own pre-aggregated hex-bin tiles directly, with no local storage or refresh job at all. Simpler and always current, but it means there's no local occurrence dataset to run spatial queries against — which is what blocks gap analysis (gap #9).
- **Global `Sample` list, projects as an add-on → projects as the hub.** The plan treated `Project` as one entity among several; the app that shipped makes a project's own tabs (Info/Samples/Lab/Bioinformatics/Notes/References) the primary way most work happens, with the Database page as the cross-project view. `SampleProject` (many-to-many) still exists as planned — a sample can belong to multiple projects.
- **New entirely outside the original plan**: Collections, Protocols, per-project marker styling, the whole-project PDF compiler, and the References/Crossref lookup section.

## Open gaps, reviewed for fit

The original roadmap's phases don't map cleanly onto what shipped, so here's every substantive gap from that plan, assessed against the architecture and usage pattern that actually emerged (single lab, no auth, flat-column/CSV-native, project-first).

| # | Gap | Verdict | Why |
|---|---|---|---|
| 1 | CSV import: flag a duplicate `primary_identifier` as a possible update, instead of hard-blocking the whole batch | **Worth doing** | Cheap — it's a change to the existing staging/validation logic, not new architecture — and it's a real, recurring friction point given how CSV-first this app is. |
| 2 | Sample attachments (photos, chromatograms) | **Worth doing** | The image-upload-to-a-public-bucket pattern already exists twice (project background images, protocol PDFs); a `sample-attachments` bucket + a small linking table is the same shape again. High value for a tissue/specimen tracker. |
| 3 | Linked external accessions (NCBI SRA/BioSample IDs) | **Worth doing** | Just one or two more optional text columns via the existing `OPTIONAL_FIELDS` mechanism — no new architecture at all. |
| 4 | Per-sample timeline view (every Lab + Bioinformatic workflow stage, in order, for one sample) | **Worth considering** | Real value for tracing one sample's history, and nothing blocks it — but it means a new cross-workflow aggregation query (entries + detail values across every workflow a sample appears in), not a trivial add. |
| 5 | Multi-select + bulk edit on sample tables | **Lower priority** | Most of the practical need is already covered by the CSV export → edit → re-import round trip, plus the workflow grids' own fill-handle and Editing mode. A dedicated bulk-edit UI would be a convenience layer on existing capability, not a new one. |
| 6 | Auth & per-user roles (Owner/Lab member/Collaborator + RLS) | **Only if collaborators are imminent** | This is the biggest lift on the list — Supabase Auth, RLS policies across ~25 tables, and permission gating on every page and API route. Nothing about the current single-key architecture blocks bolting this on later, so there's no urgency unless multiple people with different access levels are actually about to use this. |
| 7 | `SampleIdentifier` as a normalized many-to-many table (arbitrary repeatable identifier types) | **Skip as originally scoped** | Cuts against the app's whole flat-column philosophy. If more than the existing `additional_number` field is ever needed, add named columns the same way `genus`/`taxon_order` were added (via `OPTIONAL_FIELDS`) — simpler and consistent with everything else, at the cost of not being fully open-ended. |
| 8 | `Method` vocabulary with autocomplete-from-history | **Skip for now** | Preset step vocabularies already exist for both workflow types. A general "remember values typed before" autocomplete would really be a Detailed-table-wide UX nicety, not something specific to methods — revisit only if manual re-typing becomes a real complaint. |
| 9 | Gap analysis (regions with GBIF records but no nearby lab sample) | **Skip unless it's a concrete deliverable** | This needs actual cached occurrence points and a spatial join, i.e. reversing the live-tile decision above and likely adding PostGIS — a real architecture change, not an incremental feature. Worth it only if gap analysis becomes something the lab actually needs to produce, not a "nice to have." |
| 10 | PostGIS | **Skip** | Nothing today needs a server-side spatial query. Only relevant if gap analysis (#9) gets greenlit. |
| 11 | Notifications (e.g. "sample stuck at extracted for 90+ days") | **Skip** | There's no notification delivery mechanism (email/push) anywhere in the app, and nothing else has asked for one. This needs that infrastructure decided first, independent of workflow tracking itself. |
| 12 | Per-project collaborator invites | **Blocked on #6** | Meaningless without an identity system. |
| 13 | Public/read-only project view (e.g. for a paper's data-availability statement) | **Worth pulling forward independently** | Unlike full collaborator invites, a single opaque share-token URL for one project doesn't need full auth — it's the one piece of the original "collaboration" phase that fits the current architecture without waiting on #6. |
| 14 | Publish back to GBIF as an occurrence dataset | **Skip** | Niche and speculative — nothing so far suggests this is actually needed. |

## Open questions (updated)

- **Attachments scope**: if gap #2 gets built, is a flat "attachments" list per sample enough, or does it need categories (e.g. distinguish a specimen photo from a gel image from a chromatogram)?
- **Share-token scope** (gap #13): read-only for the whole project, or should some tabs (e.g. internal Lab Workflow notes) stay hidden even on a shared link?
- **Auth timing** (gap #6): revisit once/if a second person needs their own access to this instance, rather than speculatively building it now.

Everything else from the original "open questions" section (fixed `SampleIdentifier` types, `primary_identifier` format validation, starting `Method`/status vocabularies, day-one data migration) has since been settled by what actually shipped — `primary_identifier` is validated against `^[A-Za-z0-9_-]+$`, and both workflow types ship with editable preset step vocabularies rather than a fixed enum.
