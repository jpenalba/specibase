"use client";

import { useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { MapLayer } from "@/lib/layers";
import { LayerShape, LAYER_SHAPES } from "@/lib/layer-shapes";
import { PICKABLE_LAYER_COLORS } from "@/lib/layer-colors";
import { GbifSpeciesLayer } from "@/lib/gbif-store";
import { Checkbox } from "@/components/ui/checkbox";
import { LayerShapeIcon } from "./layer-shape-icon";
import { AddGbifSpeciesDialog } from "./add-gbif-species-dialog";
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

// GBIF species are their own top-level group, expandable/collapsible like
// a folder — unlike the sample-based layers above, they have no color/shape
// picker (a fixed set of GBIF's own tile styles instead, chosen once when
// adding) and can't be made "active" for the table below, since there's no
// sample subset behind a raster density tile.
function GbifGroup({
  species,
  visibleGbifIds,
  onToggleVisible,
  onRemove,
  onAdded,
}: {
  species: GbifSpeciesLayer[];
  visibleGbifIds: Set<string>;
  onToggleVisible: (id: string) => void;
  onRemove: (id: string) => void;
  onAdded: (layer: GbifSpeciesLayer) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label={expanded ? "Collapse GBIF layers" : "Expand GBIF layers"}
          aria-expanded={expanded}
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className="flex-1 truncate text-sm font-medium">GBIF</span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Add a species range from GBIF"
          title="Add a species range from GBIF"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {expanded &&
        (species.length === 0 ? (
          <p className="ml-9 px-2 py-1.5 text-xs text-muted-foreground">No species added yet</p>
        ) : (
          species.map((sp) => (
            <div key={sp.id} className="ml-5 flex items-center gap-2 rounded-md px-2 py-1.5">
              <Checkbox
                checked={visibleGbifIds.has(sp.id)}
                onCheckedChange={() => onToggleVisible(sp.id)}
                aria-label={`Show ${sp.scientific_name} on the map`}
              />
              <span className="flex-1 truncate text-sm italic" title={sp.scientific_name}>
                {sp.scientific_name}
              </span>
              <button
                type="button"
                onClick={() => onRemove(sp.id)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${sp.scientific_name}`}
                title="Remove"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        ))}

      <AddGbifSpeciesDialog open={addOpen} onOpenChange={setAddOpen} onAdded={onAdded} />
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
  gbifSpecies,
  visibleGbifIds,
  onToggleGbifVisible,
  onGbifAdded,
  onGbifRemoved,
}: {
  root: MapLayer;
  projectLayers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
  onToggleVisible: (layerId: string) => void;
  onSelectActive: (layerId: string) => void;
  onSetColor: (layerId: string, color: string) => void;
  onSetShape: (layerId: string, shape: LayerShape) => void;
  gbifSpecies: GbifSpeciesLayer[];
  visibleGbifIds: Set<string>;
  onToggleGbifVisible: (id: string) => void;
  onGbifAdded: (layer: GbifSpeciesLayer) => void;
  onGbifRemoved: (id: string) => void;
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

      <div className="my-1 border-t border-border" />

      <GbifGroup
        species={gbifSpecies}
        visibleGbifIds={visibleGbifIds}
        onToggleVisible={onToggleGbifVisible}
        onRemove={onGbifRemoved}
        onAdded={onGbifAdded}
      />
    </div>
  );
}
