import { Collection, CollectionSample } from "./collections-store";
import { COLLECTION_TYPES, CollectionType } from "./collection-types";
import { MapLayer, LayerStyle } from "./layers";
import { colorForCategoryIndex } from "./layer-colors";
import { DEFAULT_LAYER_SHAPE } from "./layer-shapes";

export type CollectionLayer = MapLayer & { collectionType: CollectionType };

// One layer per collection (not per type — the type is just how the layer
// panel groups/folds them). A collection's own id is reused as the layer
// id, same convention as a project's layer using the project's own id.
export function buildCollectionLayers(
  collections: Collection[],
  collectionSamples: CollectionSample[],
  styleOverrides?: Map<string, LayerStyle>
): CollectionLayer[] {
  const sampleIdsByCollection = new Map<string, Set<string>>();
  for (const sample of collectionSamples) {
    const set = sampleIdsByCollection.get(sample.collection_id) ?? new Set<string>();
    set.add(sample.id);
    sampleIdsByCollection.set(sample.collection_id, set);
  }

  // Sorted by name (not creation order) so the automatic color assignment
  // below stays stable regardless of the order collections were added in.
  const sorted = [...collections].sort((a, b) => a.name.localeCompare(b.name));

  return sorted.map((collection, index) => {
    const style = styleOverrides?.get(collection.id);
    return {
      id: collection.id,
      label: collection.name,
      color: style?.color ?? colorForCategoryIndex(index),
      shape: style?.shape ?? DEFAULT_LAYER_SHAPE,
      sampleIds: sampleIdsByCollection.get(collection.id) ?? new Set(),
      collectionType: collection.collection_type,
    };
  });
}

// Buckets an already-built layer list by type, in a fixed display order,
// dropping any type with no collections — the layer panel renders one
// collapsible folder per entry here, same idea as its GBIF group.
export function groupCollectionLayersByType(
  layers: CollectionLayer[]
): { type: CollectionType; layers: CollectionLayer[] }[] {
  return COLLECTION_TYPES.map((type) => ({
    type,
    layers: layers.filter((l) => l.collectionType === type),
  })).filter((group) => group.layers.length > 0);
}
