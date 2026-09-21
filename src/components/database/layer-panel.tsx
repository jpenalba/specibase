"use client";

import { useState } from "react";
import { MapLayer } from "@/lib/layers";
import { LayerShape, LAYER_SHAPES } from "@/lib/layer-shapes";
import { PICKABLE_LAYER_COLORS } from "@/lib/layer-colors";
import { Checkbox } from "@/components/ui/checkbox";
import { LayerShapeIcon } from "./layer-shape-icon";
import { cn } from "@/lib/utils";

function StylePicker({
  layer,
  onSetColor,
  onSetShape,
}: {
  layer: MapLayer;
  onSetColor: (color: string) => void;
  onSetShape: (shape: LayerShape) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
        title="Change this layer's map color and shape"
        aria-label={`Change ${layer.label}'s map color and shape`}
      >
        <LayerShapeIcon shape={layer.shape} color={layer.color} />
      </button>

      {open && (
        <>
          {/* Click-outside backdrop — simpler than wiring a document
              listener for what's meant to be a small, basic picker. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-20 mt-1 w-40 rounded-md border border-border bg-card p-2 shadow-md">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Color</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {PICKABLE_LAYER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onSetColor(color)}
                  className={cn(
                    "size-5 rounded-full border",
                    color === layer.color ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Set color to ${color}`}
                  title={color}
                />
              ))}
            </div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Shape</p>
            <div className="flex gap-1">
              {LAYER_SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => onSetShape(shape)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded border",
                    shape === layer.shape
                      ? "border-foreground bg-accent"
                      : "border-transparent hover:bg-accent"
                  )}
                  aria-label={`Set shape to ${shape}`}
                  title={shape}
                >
                  <LayerShapeIcon shape={shape} color={layer.color} size={16} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LayerRow({
  layer,
  count,
  visible,
  active,
  indent,
  onToggleVisible,
  onSelectActive,
  onSetColor,
  onSetShape,
}: {
  layer: MapLayer;
  count: number;
  visible: boolean;
  active: boolean;
  indent: boolean;
  onToggleVisible: () => void;
  onSelectActive: () => void;
  onSetColor: (color: string) => void;
  onSetShape: (shape: LayerShape) => void;
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
      <StylePicker layer={layer} onSetColor={onSetColor} onSetShape={onSetShape} />
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
  onSetColor,
  onSetShape,
}: {
  root: MapLayer;
  projectLayers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
  onToggleVisible: (layerId: string) => void;
  onSelectActive: (layerId: string) => void;
  onSetColor: (layerId: string, color: string) => void;
  onSetShape: (layerId: string, shape: LayerShape) => void;
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
        onSetColor={(color) => onSetColor(root.id, color)}
        onSetShape={(shape) => onSetShape(root.id, shape)}
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
            onSetColor={(color) => onSetColor(layer.id, color)}
            onSetShape={(shape) => onSetShape(layer.id, shape)}
          />
        ))
      )}
    </div>
  );
}
