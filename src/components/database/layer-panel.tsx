"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, X } from "lucide-react";
import { MapLayer } from "@/lib/layers";
import { LayerShape } from "@/lib/layer-shapes";
import { GbifSpeciesLayer } from "@/lib/gbif-store";
import { CollectionLayer, groupCollectionLayersByType } from "@/lib/collection-layers";
import { CollectionType, COLLECTION_TYPE_GROUP_LABELS } from "@/lib/collection-types";
import { Checkbox } from "@/components/ui/checkbox";
import { StylePicker } from "./style-picker";
import { AddGbifSpeciesDialog } from "./add-gbif-species-dialog";
import { cn } from "@/lib/utils";

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
      <StylePicker
        color={layer.color}
        shape={layer.shape}
        label={layer.label}
        onSetColor={onSetColor}
        onSetShape={onSetShape}
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

// A collection's row — same shape as LayerRow (checkbox, StylePicker,
// sample count), but the label links out to that collection's own sample
// list instead of selecting it "active" for the table below, since a
// collection's samples live in their own table and the shared
// SampleTable/edit flow only knows how to talk to the main `samples` API.
function CollectionLayerRow({
  layer,
  visible,
  onToggleVisible,
  onSetColor,
  onSetShape,
}: {
  layer: CollectionLayer;
  visible: boolean;
  onToggleVisible: () => void;
  onSetColor: (color: string) => void;
  onSetShape: (shape: LayerShape) => void;
}) {
  return (
    <div className="ml-5 flex items-center gap-2 rounded-md px-2 py-1.5">
      <Checkbox checked={visible} onCheckedChange={onToggleVisible} />
      <StylePicker
        color={layer.color}
        shape={layer.shape}
        label={layer.label}
        onSetColor={onSetColor}
        onSetShape={onSetShape}
      />
      <Link
        href={`/collections/${layer.id}/samples`}
        className="flex-1 truncate text-sm text-foreground hover:underline"
        title={`View ${layer.label}'s own sample list`}
      >
        {layer.label}
      </Link>
      <span className="text-xs text-muted-foreground">{layer.sampleIds.size}</span>
    </div>
  );
}

// One collapsible folder per collection type (Field/Museum/Collaborator/
// Other), same expand/collapse pattern as GbifGroup — unlike GbifGroup,
// there's no "add" button here, since collections are created from the
// Collections page, not from this panel.
function CollectionTypeGroup({
  type,
  layers,
  visibleLayerIds,
  onToggleVisible,
  onSetColor,
  onSetShape,
}: {
  type: CollectionType;
  layers: CollectionLayer[];
  visibleLayerIds: Set<string>;
  onToggleVisible: (layerId: string) => void;
  onSetColor: (layerId: string, color: string) => void;
  onSetShape: (layerId: string, shape: LayerShape) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = COLLECTION_TYPE_GROUP_LABELS[type];

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className="flex-1 truncate text-sm font-medium">{label}</span>
      </div>
      {expanded &&
        layers.map((layer) => (
          <CollectionLayerRow
            key={layer.id}
            layer={layer}
            visible={visibleLayerIds.has(layer.id)}
            onToggleVisible={() => onToggleVisible(layer.id)}
            onSetColor={(color) => onSetColor(layer.id, color)}
            onSetShape={(shape) => onSetShape(layer.id, shape)}
          />
        ))}
    </div>
  );
}

export function LayerPanel({
  root,
  projectLayers,
  collectionLayers,
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
  collectionLayers: CollectionLayer[];
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
  const collectionGroups = groupCollectionLayersByType(collectionLayers);
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

      {collectionGroups.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No collections yet</p>
      ) : (
        collectionGroups.map(({ type, layers }) => (
          <CollectionTypeGroup
            key={type}
            type={type}
            layers={layers}
            visibleLayerIds={visibleLayerIds}
            onToggleVisible={onToggleVisible}
            onSetColor={onSetColor}
            onSetShape={onSetShape}
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
