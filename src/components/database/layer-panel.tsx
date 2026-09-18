"use client";

import { MapLayer } from "@/lib/layers";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function LayerRow({
  layer,
  count,
  visible,
  active,
  indent,
  onToggleVisible,
  onSelectActive,
}: {
  layer: MapLayer;
  count: number;
  visible: boolean;
  active: boolean;
  indent: boolean;
  onToggleVisible: () => void;
  onSelectActive: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        indent && "ml-5",
        active && "bg-accent"
      )}
    >
      <Checkbox checked={visible} onCheckedChange={onToggleVisible} />
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: layer.color }}
        aria-hidden
      />
      <button
        type="button"
        onClick={onSelectActive}
        className={cn(
          "flex-1 truncate text-left text-sm",
          active ? "font-medium" : "text-foreground"
        )}
        title="Show this layer's samples in the table below"
      >
        {layer.label}
      </button>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

export function LayerPanel({
  root,
  projectLayers,
  visibleLayerIds,
  activeLayerId,
  onToggleVisible,
  onSelectActive,
}: {
  root: MapLayer;
  projectLayers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
  onToggleVisible: (layerId: string) => void;
  onSelectActive: (layerId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
      <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
        Layers — tick to show on the map, click a name to view it below
      </p>
      <LayerRow
        layer={root}
        count={root.sampleIds.size}
        visible={visibleLayerIds.has(root.id)}
        active={activeLayerId === root.id}
        indent={false}
        onToggleVisible={() => onToggleVisible(root.id)}
        onSelectActive={() => onSelectActive(root.id)}
      />
      {projectLayers.length === 0 ? (
        <p className="ml-5 px-2 py-1.5 text-xs text-muted-foreground">
          No projects yet
        </p>
      ) : (
        projectLayers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            count={layer.sampleIds.size}
            visible={visibleLayerIds.has(layer.id)}
            active={activeLayerId === layer.id}
            indent
            onToggleVisible={() => onToggleVisible(layer.id)}
            onSelectActive={() => onSelectActive(layer.id)}
          />
        ))
      )}
    </div>
  );
}
