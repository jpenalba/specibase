"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SampleRecord } from "@/lib/samples-store";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { GbifSpeciesLayer } from "@/lib/gbif-store";
import { Collection, CollectionSample } from "@/lib/collections-store";
import { buildLayers, ALL_LAYER_ID, LayerStyle } from "@/lib/layers";
import { buildCollectionLayers } from "@/lib/collection-layers";
import { LayerShape } from "@/lib/layer-shapes";
import { getVisibleColumns } from "@/lib/fields";
import { samplesToCsv, downloadTextFile } from "@/lib/csv";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { SampleMap } from "@/components/database/sample-map";
import { LayerPanel } from "@/components/database/layer-panel";
import { SampleTable } from "@/components/samples/sample-table";
import { FieldPicker } from "@/components/samples/field-picker";
import { AddSamplesPanel } from "@/components/samples/add-samples-panel";
import { Button } from "@/components/ui/button";

export default function DatabasePage() {
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [gbifError, setGbifError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionSamples, setCollectionSamples] = useState<CollectionSample[]>([]);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<string>>(
    new Set([ALL_LAYER_ID])
  );
  const [activeLayerId, setActiveLayerId] = useState<string>(ALL_LAYER_ID);
  const [mapSyncError, setMapSyncError] = useState<string | null>(null);
  const [hiddenSampleIds, setHiddenSampleIds] = useState<Set<string>>(new Set());
  const [highlightedSampleId, setHighlightedSampleId] = useState<string | null>(null);
  const [layerStyles, setLayerStyles] = useState<Map<string, LayerStyle>>(new Map());
  const [editMode, setEditMode] = useState(false);
  const [gbifLayers, setGbifLayers] = useState<GbifSpeciesLayer[]>([]);
  const [visibleGbifIds, setVisibleGbifIds] = useState<Set<string>>(new Set());
  const [showAddSamples, setShowAddSamples] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const { selected, toggle } = useOptionalFields();
  const popupColumns = useMemo(() => getVisibleColumns(selected), [selected]);

  // Reloads samples and projects/links together — used on first load and
  // again after a batch is uploaded from the panel below, since a newly
  // added sample may also have been linked to a (possibly brand new)
  // project. Kept separate from the GBIF fetch, which an upload never
  // affects.
  const loadSamplesAndProjects = useCallback(() => {
    fetch("/api/samples")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) setSamplesError(data.errors.join(" "));
        else setSamples(data.samples ?? []);
      })
      .catch(() => setSamplesError("Couldn't reach the server."))
      .finally(() => setLoading(false));

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setProjectsError(data.errors.join(" "));
        } else {
          setProjects(data.projects ?? []);
          setLinks(data.links ?? []);
        }
      })
      .catch(() => setProjectsError("Couldn't reach the server."));
  }, []);

  // Collections are their own map layer group (see LayerPanel's per-type
  // folders) — kept as its own callback so a taxonomy backfill can refresh
  // just this pool without re-fetching samples/projects too.
  const loadCollections = useCallback((onDone?: () => void) => {
    Promise.all([
      fetch("/api/collections").then((res) => res.json()),
      fetch("/api/collections/samples").then((res) => res.json()),
    ])
      .then(([collectionsData, samplesData]) => {
        if (collectionsData.errors?.length > 0) {
          setCollectionsError(collectionsData.errors.join(" "));
          return;
        }
        if (samplesData.errors?.length > 0) {
          setCollectionsError(samplesData.errors.join(" "));
          return;
        }
        setCollectionsError(null);
        setCollections(collectionsData.collections ?? []);
        setCollectionSamples(samplesData.samples ?? []);
      })
      .catch(() => setCollectionsError("Couldn't reach the server."))
      .finally(() => onDone?.());
  }, []);

  useEffect(() => {
    loadSamplesAndProjects();

    // Independent of the above — a GBIF fetch failure (missing migration,
    // GBIF itself being unreachable) shouldn't block samples or projects.
    let cancelled = false;
    fetch("/api/gbif-layers")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) setGbifError(data.errors.join(" "));
        else setGbifLayers(data.layers ?? []);
      })
      .catch(() => {
        if (!cancelled) setGbifError("Couldn't reach the server.");
      });

    loadCollections();

    return () => {
      cancelled = true;
    };
  }, [loadSamplesAndProjects, loadCollections]);

  async function runTaxonomyBackfill() {
    setBackfilling(true);
    setBackfillMessage(null);
    try {
      const res = await fetch("/api/gbif/backfill-taxonomy", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBackfillMessage(data.errors?.join(" ") ?? "Couldn't run the backfill.");
        return;
      }
      const total = data.samplesUpdated + data.collectionSamplesUpdated;
      const unmatched = data.unmatchedSpecies?.length ?? 0;
      setBackfillMessage(
        `Filled in taxonomy for ${total} sample${total === 1 ? "" : "s"} from GBIF` +
          (unmatched > 0
            ? `; ${unmatched} species had no confident GBIF match and were left blank.`
            : ".")
      );
      loadSamplesAndProjects();
      loadCollections();
    } catch {
      setBackfillMessage("Couldn't reach the server.");
    } finally {
      setBackfilling(false);
    }
  }

  const { root, children } = useMemo(
    () => buildLayers(samples, projects, links, layerStyles),
    [samples, projects, links, layerStyles]
  );
  const collectionLayers = useMemo(
    () => buildCollectionLayers(collections, collectionSamples, layerStyles),
    [collections, collectionSamples, layerStyles]
  );
  // The map draws every kind of layer uniformly, so its own samples/layers
  // props get the combined pool — collection samples have their own ids
  // (never colliding with a main sample's), and only appear on the map
  // via their own layer's sampleIds, never in the table below.
  const mapSamples = useMemo(() => [...samples, ...collectionSamples], [samples, collectionSamples]);
  const mapLayers = useMemo(() => [root, ...children, ...collectionLayers], [root, children, collectionLayers]);
  const allLayers = useMemo(() => [root, ...children], [root, children]);

  const activeLayer = allLayers.find((l) => l.id === activeLayerId) ?? root;
  const tableSamples = samples.filter((s) => activeLayer.sampleIds.has(s.id));
  const mappableCount = tableSamples.filter(
    (s) => s.latitude != null && s.longitude != null
  ).length;

  function toggleVisible(layerId: string) {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  function toggleSampleHidden(sampleId: string) {
    setHiddenSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
    // A hidden sample has no marker to highlight, so drop a stale selection
    // rather than leave the table showing a highlight the map can't show.
    setHighlightedSampleId((current) => (current === sampleId ? null : current));
  }

  function setLayerColor(layerId: string, color: string) {
    setLayerStyles((prev) => {
      const next = new Map(prev);
      next.set(layerId, { ...next.get(layerId), color });
      return next;
    });
  }

  function setLayerShape(layerId: string, shape: LayerShape) {
    setLayerStyles((prev) => {
      const next = new Map(prev);
      next.set(layerId, { ...next.get(layerId), shape });
      return next;
    });
  }

  function selectSample(sampleId: string) {
    setHighlightedSampleId((current) => (current === sampleId ? null : sampleId));
  }

  function handleSampleUpdated(updated: SampleRecord) {
    setSamples((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleSampleDeleted(id: string) {
    setSamples((prev) => prev.filter((s) => s.id !== id));
    setHiddenSampleIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHighlightedSampleId((current) => (current === id ? null : current));
  }

  function toggleGbifVisible(id: string) {
    setVisibleGbifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGbifAdded(layer: GbifSpeciesLayer) {
    setGbifLayers((prev) => [...prev, layer].sort((a, b) => a.scientific_name.localeCompare(b.scientific_name)));
    // Shown immediately — adding a species you don't get to see would be a
    // strange first impression of the feature.
    setVisibleGbifIds((prev) => new Set(prev).add(layer.id));
  }

  async function handleGbifRemoved(id: string) {
    setGbifLayers((prev) => prev.filter((g) => g.id !== id));
    setVisibleGbifIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await fetch(`/api/gbif-layers/${id}`, { method: "DELETE" });
    } catch {
      // Best-effort — worst case it reappears on the next reload, at which
      // point removing it again just retries the same request.
    }
  }

  function exportCsv() {
    const csv = samplesToCsv(tableSamples, popupColumns);
    const slug = activeLayer.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadTextFile(`specibase-${slug || "export"}.csv`, csv, "text/csv;charset=utf-8;");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Database</h1>
          <p className="text-sm text-muted-foreground">
            Everything already uploaded. Tick a layer to show it on the map;
            click a layer&apos;s name to view its samples in the table below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={runTaxonomyBackfill} disabled={backfilling}>
            {backfilling ? "Backfilling taxonomy..." : "Backfill taxonomy from GBIF"}
          </Button>
          <Button variant="outline" onClick={() => setShowAddSamples((v) => !v)}>
            {showAddSamples ? "Hide add samples" : "Add samples"}
          </Button>
        </div>
      </div>

      <div className={showAddSamples ? "" : "hidden"}>
        <AddSamplesPanel onUploaded={loadSamplesAndProjects} />
      </div>

      {backfillMessage && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          {backfillMessage}
        </div>
      )}

      {samplesError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load samples: {samplesError}
        </div>
      )}
      {projectsError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load projects: {projectsError}. If you haven&apos;t
          already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0001_optional_location_and_projects.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}
      {gbifError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load GBIF species layers: {gbifError}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0005_gbif_species_layers.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}
      {collectionsError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load collections: {collectionsError}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0017_collection_types.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}
      {mapSyncError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          The map couldn&apos;t draw the points: {mapSyncError}
        </div>
      )}

      <div className="flex h-[55vh] min-h-[420px] gap-4">
        <div className="flex-1 overflow-hidden rounded-lg border border-border">
          <SampleMap
            samples={mapSamples}
            layers={mapLayers}
            visibleLayerIds={visibleLayerIds}
            popupColumns={popupColumns}
            onSyncError={setMapSyncError}
            hiddenSampleIds={hiddenSampleIds}
            highlightedSampleId={highlightedSampleId}
            gbifLayers={gbifLayers}
            visibleGbifIds={visibleGbifIds}
          />
        </div>
        <div className="w-64 shrink-0">
          <LayerPanel
            root={root}
            projectLayers={children}
            collectionLayers={collectionLayers}
            visibleLayerIds={visibleLayerIds}
            activeLayerId={activeLayerId}
            onToggleVisible={toggleVisible}
            onSelectActive={setActiveLayerId}
            onSetColor={setLayerColor}
            onSetShape={setLayerShape}
            gbifSpecies={gbifLayers}
            visibleGbifIds={visibleGbifIds}
            onToggleGbifVisible={toggleGbifVisible}
            onGbifAdded={handleGbifAdded}
            onGbifRemoved={handleGbifRemoved}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-medium">{activeLayer.label}</h2>
            <p className="text-sm text-muted-foreground">
              {tableSamples.length} sample{tableSamples.length === 1 ? "" : "s"}
              {tableSamples.length > 0 &&
                ` (${mappableCount} with map coordinates)`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={tableSamples.length === 0}>
            Export CSV
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <FieldPicker selected={selected} onToggle={toggle} />
          {!editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
              disabled={tableSamples.length === 0}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <SampleTable
          samples={tableSamples}
          allIdentifiers={samples.map((s) => s.primary_identifier)}
          visibleOptionalKeys={selected}
          hiddenSampleIds={hiddenSampleIds}
          onToggleHidden={toggleSampleHidden}
          highlightedSampleId={highlightedSampleId}
          onSelectSample={selectSample}
          editMode={editMode}
          onExitEditMode={() => setEditMode(false)}
          onSampleUpdated={handleSampleUpdated}
          onSampleDeleted={handleSampleDeleted}
        />
      )}
    </div>
  );
}
