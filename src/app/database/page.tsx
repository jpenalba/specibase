"use client";

import { useEffect, useMemo, useState } from "react";
import { SampleRecord } from "@/lib/samples-store";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { buildLayers, ALL_LAYER_ID } from "@/lib/layers";
import { getVisibleColumns } from "@/lib/fields";
import { samplesToCsv, downloadTextFile } from "@/lib/csv";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { SampleMap } from "@/components/database/sample-map";
import { LayerPanel } from "@/components/database/layer-panel";
import { SampleTable } from "@/components/samples/sample-table";
import { FieldPicker } from "@/components/samples/field-picker";
import { Button } from "@/components/ui/button";

export default function DatabasePage() {
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<string>>(
    new Set([ALL_LAYER_ID])
  );
  const [activeLayerId, setActiveLayerId] = useState<string>(ALL_LAYER_ID);
  const [mapSyncError, setMapSyncError] = useState<string | null>(null);
  const [hiddenSampleIds, setHiddenSampleIds] = useState<Set<string>>(new Set());
  const [highlightedSampleId, setHighlightedSampleId] = useState<string | null>(null);
  const { selected, toggle } = useOptionalFields();
  const popupColumns = useMemo(() => getVisibleColumns(selected), [selected]);

  useEffect(() => {
    let cancelled = false;

    // Fetched independently — projects failing to load (e.g. the
    // projects/sample_projects migration hasn't been run yet) must not
    // also block samples from showing up.
    fetch("/api/samples")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) setSamplesError(data.errors.join(" "));
        else setSamples(data.samples ?? []);
      })
      .catch(() => {
        if (!cancelled) setSamplesError("Couldn't reach the server.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) {
          setProjectsError(data.errors.join(" "));
        } else {
          setProjects(data.projects ?? []);
          setLinks(data.links ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setProjectsError("Couldn't reach the server.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { root, children } = useMemo(
    () => buildLayers(samples, projects, links),
    [samples, projects, links]
  );
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

  function selectSample(sampleId: string) {
    setHighlightedSampleId((current) => (current === sampleId ? null : sampleId));
  }

  function exportCsv() {
    const csv = samplesToCsv(tableSamples, popupColumns);
    const slug = activeLayer.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadTextFile(`specibase-${slug || "export"}.csv`, csv, "text/csv;charset=utf-8;");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold">Database</h1>
        <p className="text-sm text-muted-foreground">
          Everything already uploaded. Tick a layer to show it on the map;
          click a layer&apos;s name to view its samples in the table below.
        </p>
      </div>

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
      {mapSyncError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          The map couldn&apos;t draw the points: {mapSyncError}
        </div>
      )}

      <div className="flex h-[55vh] min-h-[420px] gap-4">
        <div className="flex-1 overflow-hidden rounded-lg border border-border">
          <SampleMap
            samples={samples}
            layers={allLayers}
            visibleLayerIds={visibleLayerIds}
            activeLayerId={activeLayerId}
            popupColumns={popupColumns}
            onSyncError={setMapSyncError}
            hiddenSampleIds={hiddenSampleIds}
            highlightedSampleId={highlightedSampleId}
          />
        </div>
        <div className="w-64 shrink-0">
          <LayerPanel
            root={root}
            projectLayers={children}
            visibleLayerIds={visibleLayerIds}
            activeLayerId={activeLayerId}
            onToggleVisible={toggleVisible}
            onSelectActive={setActiveLayerId}
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
        <FieldPicker selected={selected} onToggle={toggle} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <SampleTable
          samples={tableSamples}
          visibleOptionalKeys={selected}
          hiddenSampleIds={hiddenSampleIds}
          onToggleHidden={toggleSampleHidden}
          highlightedSampleId={highlightedSampleId}
          onSelectSample={selectSample}
        />
      )}
    </div>
  );
}
