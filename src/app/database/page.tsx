"use client";

import { useEffect, useMemo, useState } from "react";
import { SampleRecord } from "@/lib/samples-store";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { buildLayers, ALL_LAYER_ID } from "@/lib/layers";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { SampleMap } from "@/components/database/sample-map";
import { LayerPanel } from "@/components/database/layer-panel";
import { SampleTable } from "@/components/samples/sample-table";
import { FieldPicker } from "@/components/samples/field-picker";

export default function DatabasePage() {
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<string>>(
    new Set([ALL_LAYER_ID])
  );
  const [activeLayerId, setActiveLayerId] = useState<string>(ALL_LAYER_ID);
  const { selected, toggle } = useOptionalFields();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [samplesRes, projectsRes] = await Promise.all([
          fetch("/api/samples"),
          fetch("/api/projects"),
        ]);
        const samplesData = await samplesRes.json();
        const projectsData = await projectsRes.json();
        if (cancelled) return;
        setSamples(samplesData.samples ?? []);
        setProjects(projectsData.projects ?? []);
        setLinks(projectsData.links ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold">Database</h1>
        <p className="text-sm text-muted-foreground">
          Everything already uploaded. Tick a layer to show it on the map;
          click a layer&apos;s name to view its samples in the table below.
        </p>
      </div>

      <div className="flex h-[55vh] min-h-[420px] gap-4">
        <div className="flex-1 overflow-hidden rounded-lg border border-border">
          <SampleMap
            samples={samples}
            layers={allLayers}
            visibleLayerIds={visibleLayerIds}
            activeLayerId={activeLayerId}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">{activeLayer.label}</h2>
          <p className="text-sm text-muted-foreground">
            {tableSamples.length} sample{tableSamples.length === 1 ? "" : "s"}
            {tableSamples.length > 0 &&
              ` (${mappableCount} with map coordinates)`}
          </p>
        </div>
        <FieldPicker selected={selected} onToggle={toggle} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <SampleTable samples={tableSamples} visibleOptionalKeys={selected} />
      )}
    </div>
  );
}
