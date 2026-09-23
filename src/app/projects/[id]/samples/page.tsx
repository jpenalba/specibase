"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SampleRecord } from "@/lib/samples-store";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { MapLayer } from "@/lib/layers";
import { MAIN_DATABASE_COLOR } from "@/lib/layer-colors";
import { DEFAULT_LAYER_SHAPE, LayerShape } from "@/lib/layer-shapes";
import { getVisibleColumns } from "@/lib/fields";
import { samplesToCsv, downloadTextFile } from "@/lib/csv";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { MarkerStyle } from "@/lib/project-marker-styles-store";
import { buildProjectMapLayer, resolveCategoryStyles } from "@/lib/marker-style";
import { SampleMap } from "@/components/database/sample-map";
import { SampleTable } from "@/components/samples/sample-table";
import { FieldPicker } from "@/components/samples/field-picker";
import { SamplePicker } from "@/components/projects/sample-picker";
import { AddSamplesPanel } from "@/components/samples/add-samples-panel";
import { MarkerStylePanel } from "@/components/projects/marker-style-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// This project's own samples, shown the same way the main Database page
// shows everything — a map plus a table — just pre-scoped to one implicit
// "layer" (this project) rather than the root/children layer picker, since
// there's nothing to switch between here.
export default function ProjectSamplesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [markerStyles, setMarkerStyles] = useState<MarkerStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapSyncError, setMapSyncError] = useState<string | null>(null);

  const [hiddenSampleIds, setHiddenSampleIds] = useState<Set<string>>(new Set());
  const [highlightedSampleId, setHighlightedSampleId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { selected, toggle } = useOptionalFields();
  const popupColumns = useMemo(() => getVisibleColumns(selected), [selected]);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/samples").then((res) => res.json()),
      fetch("/api/projects").then((res) => res.json()),
      fetch(`/api/projects/${projectId}/marker-styles`).then((res) => res.json()),
    ])
      .then(([samplesData, projectsData, markerStylesData]) => {
        if (samplesData.errors?.length > 0) {
          setError(samplesData.errors.join(" "));
          return;
        }
        if (projectsData.errors?.length > 0) {
          setError(projectsData.errors.join(" "));
          return;
        }
        if (markerStylesData.errors?.length > 0) {
          setError(markerStylesData.errors.join(" "));
          return;
        }
        setError(null);
        setSamples(samplesData.samples ?? []);
        setLinks(projectsData.links ?? []);
        setProject((projectsData.projects ?? []).find((p: Project) => p.id === projectId) ?? null);
        setMarkerStyles(markerStylesData.styles ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const linkedSampleIds = useMemo(
    () => new Set(links.filter((l) => l.project_id === projectId).map((l) => l.sample_id)),
    [links, projectId]
  );

  const tableSamples = useMemo(
    () => samples.filter((s) => linkedSampleIds.has(s.id)),
    [samples, linkedSampleIds]
  );
  const mappableCount = tableSamples.filter((s) => s.latitude != null && s.longitude != null).length;

  const markerStyleField = project?.marker_style_field ?? null;
  const singleColor = project?.marker_color ?? MAIN_DATABASE_COLOR;
  const singleShape = project?.marker_shape ?? DEFAULT_LAYER_SHAPE;

  const categories = useMemo(
    () =>
      markerStyleField ? resolveCategoryStyles(tableSamples, markerStyleField, markerStyles) : [],
    [markerStyleField, tableSamples, markerStyles]
  );

  const layer: MapLayer = useMemo(
    () =>
      buildProjectMapLayer(
        projectId,
        tableSamples,
        linkedSampleIds,
        markerStyleField,
        singleColor,
        singleShape,
        markerStyles
      ),
    [projectId, tableSamples, linkedSampleIds, markerStyleField, singleColor, singleShape, markerStyles]
  );
  const visibleLayerIds = useMemo(() => new Set([projectId]), [projectId]);

  async function patchProject(patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't save the marker style.");
        return;
      }
      setProject(data.project);
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  function handleMarkerFieldChange(key: string | null) {
    patchProject({ marker_style_field: key });
  }

  function handleSingleStyleChange(color: string, shape: LayerShape) {
    patchProject({ marker_color: color, marker_shape: shape });
  }

  async function handleCategoryStyleChange(value: string, color: string, shape: LayerShape) {
    if (!markerStyleField) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/marker-styles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_key: markerStyleField, field_value: value, color, shape }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't save that marker style.");
        return;
      }
      setMarkerStyles((prev) => [
        ...prev.filter((s) => !(s.field_key === markerStyleField && s.field_value === value)),
        data.style,
      ]);
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  async function handleCategoryStyleReset(value: string) {
    if (!markerStyleField) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/marker-styles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_key: markerStyleField, field_value: value }),
      });
      if (!res.ok) {
        setError("Couldn't reset that marker style.");
        return;
      }
      setMarkerStyles((prev) =>
        prev.filter((s) => !(s.field_key === markerStyleField && s.field_value === value))
      );
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  function toggleSampleHidden(sampleId: string) {
    setHiddenSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
    setHighlightedSampleId((current) => (current === sampleId ? null : current));
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

  function exportCsv() {
    const csv = samplesToCsv(tableSamples, popupColumns);
    downloadTextFile("specibase-project-samples.csv", csv, "text/csv;charset=utf-8;");
  }

  async function handleLinkSelected() {
    if (addSelection.size === 0) return;
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [...addSelection] }),
      });
      if (res.ok) {
        setAddSelection(new Set());
        load();
      } else {
        setLinkError("Couldn't link the selected samples.");
      }
    } catch {
      setLinkError("Couldn't reach the server.");
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(sampleId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/samples`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [sampleId] }),
      });
      if (res.ok) load();
      else setLinkError("Couldn't remove that sample from the project.");
    } catch {
      setLinkError("Couldn't reach the server.");
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading...</p>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      {mapSyncError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          The map couldn&apos;t draw the points: {mapSyncError}
        </div>
      )}

      <MarkerStylePanel
        fieldKey={markerStyleField}
        onFieldChange={handleMarkerFieldChange}
        singleColor={singleColor}
        singleShape={singleShape}
        onSingleStyleChange={handleSingleStyleChange}
        categories={categories}
        onCategoryStyleChange={handleCategoryStyleChange}
        onCategoryStyleReset={handleCategoryStyleReset}
      />

      <div className="flex h-[55vh] min-h-[420px] overflow-hidden rounded-lg border border-border">
        <SampleMap
          samples={samples}
          layers={[layer]}
          visibleLayerIds={visibleLayerIds}
          popupColumns={popupColumns}
          onSyncError={setMapSyncError}
          hiddenSampleIds={hiddenSampleIds}
          highlightedSampleId={highlightedSampleId}
          gbifLayers={[]}
          visibleGbifIds={new Set()}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">
            {tableSamples.length} sample{tableSamples.length === 1 ? "" : "s"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tableSamples.length > 0 && `${mappableCount} with map coordinates`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={tableSamples.length === 0}>
            Export CSV
          </Button>
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
        extraRowAction={{ label: "Remove from project", onSelect: (s) => handleRemove(s.id) }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Add from the main database</CardTitle>
          <CardDescription>
            Search for samples already in the database and link them to this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {linkError && <p className="text-sm text-destructive">{linkError}</p>}
          <SamplePicker
            selectedIds={addSelection}
            onChange={setAddSelection}
            excludeIds={linkedSampleIds}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleLinkSelected} disabled={addSelection.size === 0 || linking}>
            {linking ? "Linking..." : `Link ${addSelection.size} sample(s)`}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add new samples</CardTitle>
          <CardDescription>
            Stage new samples here, then upload — linked to this project automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSamplesPanel fixedProjectId={projectId} onUploaded={load} />
        </CardContent>
      </Card>
    </div>
  );
}
