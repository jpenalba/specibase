"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Popup, NavigationControl, LngLatBounds, MapMouseEvent } from "maplibre-gl";
import { SampleRecord } from "@/lib/samples-store";
import { MapLayer } from "@/lib/layers";

// A deliberately minimal shape for what this component builds — the full
// maplibre-gl StyleSpecification type isn't re-exported from the package's
// top-level entry point (only from its internal style-spec dependency),
// and MapLibre validates the real shape at runtime regardless.
type SimpleStyle = {
  version: 8;
  sources: Record<
    string,
    | { type: "raster"; tiles: string[]; tileSize: number; attribution: string }
    | { type: "geojson"; data: GeoJSON.FeatureCollection<GeoJSON.Point> }
  >;
  layers: (
    | { id: string; type: "raster"; source: string }
    | { id: string; type: "circle"; source: string; paint: Record<string, unknown> }
  )[];
};

// No API key required — OpenStreetMap's raster tiles work with zero setup,
// which matters for a lab tool that should run the moment it's deployed.
// Their usage policy isn't meant for heavy production traffic, though: if
// this gets real day-to-day use, switch to a proper provider (MapTiler,
// Stadia Maps, Mapbox) with its own key.
const OSM_SOURCE = {
  type: "raster" as const,
  tiles: [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  tileSize: 256,
  attribution: "&copy; OpenStreetMap contributors",
};

function sourceId(layerId: string) {
  return `layer-source-${layerId}`;
}
function circleLayerId(layerId: string) {
  return `layer-circle-${layerId}`;
}

function toFeatureCollection(
  samples: SampleRecord[],
  sampleIds: Set<string>
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const s of samples) {
    if (!sampleIds.has(s.id)) continue;
    // Coerced defensively — GeoJSON coordinates must be numbers, and
    // Supabase/PostgREST returning some numeric types as strings is a
    // known gotcha worth guarding against rather than silently dropping
    // every point.
    const lat = Number(s.latitude);
    const lon = Number(s.longitude);
    if (s.latitude == null || s.longitude == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      continue;
    }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: s.id,
        primary_identifier: s.primary_identifier,
        species: s.species,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

// Builds the *entire* style from scratch every time, rather than issuing
// incremental addLayer/removeLayer/setData calls against whatever state
// the map happens to be in. MapLibre's setStyle diffs against the current
// style internally (so this doesn't reload the unchanged raster tiles),
// and a full rebuild can't drift out of sync with React state the way a
// sequence of imperative mutations across renders can.
function buildStyle(
  layers: MapLayer[],
  visibleLayerIds: Set<string>,
  samples: SampleRecord[],
  activeLayerId: string
): { style: SimpleStyle; coords: [number, number][]; counts: Record<string, number> } {
  const sources: SimpleStyle["sources"] = { osm: OSM_SOURCE };
  const styleLayers: SimpleStyle["layers"] = [{ id: "osm", type: "raster", source: "osm" }];
  const coords: [number, number][] = [];
  const counts: Record<string, number> = {};

  for (const layer of layers) {
    if (!visibleLayerIds.has(layer.id)) continue;
    const data = toFeatureCollection(samples, layer.sampleIds);
    counts[layer.id] = data.features.length;
    for (const f of data.features) coords.push(f.geometry.coordinates as [number, number]);

    sources[sourceId(layer.id)] = { type: "geojson", data };
    const isActive = layer.id === activeLayerId;
    styleLayers.push({
      id: circleLayerId(layer.id),
      type: "circle",
      source: sourceId(layer.id),
      paint: {
        "circle-color": layer.color,
        "circle-radius": isActive ? 7 : 5,
        "circle-stroke-width": isActive ? 2 : 1,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  return { style: { version: 8, sources, layers: styleLayers }, coords, counts };
}

export function SampleMap({
  samples,
  layers,
  visibleLayerIds,
  activeLayerId,
  onSyncError,
  onFeatureCounts,
}: {
  samples: SampleRecord[];
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
  // Both optional escape hatches so map-internal problems surface directly
  // on the page instead of only in the browser console — most people using
  // this app won't have DevTools open.
  onSyncError?: (message: string) => void;
  onFeatureCounts?: (counts: Record<string, number>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const lastCoordsRef = useRef<[number, number][]>([]);
  const interactiveLayerIdsRef = useRef<string[]>([]);
  // Always points at the latest apply function so the map's one-time
  // "load" event (which can fire before or after the first real data
  // arrives) calls whichever version is current at that moment, rather
  // than a closure captured back when the listener was registered.
  const latestApplyRef = useRef<() => void>(() => {});
  const styleReadyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: { version: 8, sources: { osm: OSM_SOURCE }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      center: [0, 0],
      zoom: 1,
    });
    map.addControl(new NavigationControl(), "top-left");

    map.on("click", (e: MapMouseEvent) => {
      if (interactiveLayerIdsRef.current.length === 0) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: interactiveLayerIdsRef.current,
      });
      if (!features.length) return;
      const props = features[0].properties as { primary_identifier: string; species: string };
      popupRef.current?.remove();
      popupRef.current = new Popup({ closeButton: true })
        .setLngLat((features[0].geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div style="font-size:13px"><strong>${props.primary_identifier}</strong><br/>${props.species}</div>`
        )
        .addTo(map);
    });

    map.on("load", () => {
      styleReadyRef.current = true;
      map.resize();
      latestApplyRef.current();
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applyStyle() {
      try {
        const { style, coords, counts } = buildStyle(layers, visibleLayerIds, samples, activeLayerId);
        lastCoordsRef.current = coords;
        interactiveLayerIdsRef.current = layers
          .filter((l) => visibleLayerIds.has(l.id))
          .map((l) => circleLayerId(l.id));
        onFeatureCounts?.(counts);

        map!.setStyle(style as Parameters<MapLibreMap["setStyle"]>[0]);
        map!.once("styledata", () => {
          map!.resize();
          if (coords.length > 0) {
            const bounds = coords.reduce(
              (b, coord) => b.extend(coord),
              new LngLatBounds(coords[0], coords[0])
            );
            map!.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 300 });
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown map error";
        console.error("Failed to apply map style", error);
        onSyncError?.(message);
      }
    }

    latestApplyRef.current = applyStyle;
    if (styleReadyRef.current) {
      applyStyle();
    }
    // If the map hasn't fired "load" yet, the mount effect's handler will
    // call latestApplyRef.current() — which by then points at this run's
    // applyStyle — once it's ready.
  }, [samples, layers, visibleLayerIds, activeLayerId, onSyncError, onFeatureCounts]);

  function fitToData() {
    const map = mapRef.current;
    const coords = lastCoordsRef.current;
    if (!map || coords.length === 0) return;
    map.resize();
    const bounds = coords.reduce(
      (b, coord) => b.extend(coord),
      new LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 300 });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-lg" />
      <button
        type="button"
        onClick={fitToData}
        className="absolute right-2 bottom-8 z-10 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-sm hover:bg-accent"
      >
        Fit to data
      </button>
    </div>
  );
}
