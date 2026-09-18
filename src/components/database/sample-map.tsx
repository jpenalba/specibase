"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Popup,
  NavigationControl,
  LngLatBounds,
  GeoJSONSource,
  MapMouseEvent,
} from "maplibre-gl";
import { SampleRecord } from "@/lib/samples-store";
import { MapLayer } from "@/lib/layers";

// No API key required — OpenStreetMap's raster tiles work with zero setup,
// which matters for a lab tool that should run the moment it's deployed.
// Their usage policy isn't meant for heavy production traffic, though: if
// this gets real day-to-day use, switch to a proper provider (MapTiler,
// Stadia Maps, Mapbox) with its own key.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
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
  const features: GeoJSON.Feature<GeoJSON.Point>[] = samples
    .filter((s) => sampleIds.has(s.id) && s.latitude != null && s.longitude != null)
    .map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.longitude as number, s.latitude as number] },
      properties: {
        id: s.id,
        primary_identifier: s.primary_identifier,
        species: s.species,
      },
    }));
  return { type: "FeatureCollection", features };
}

export function SampleMap({
  samples,
  layers,
  visibleLayerIds,
  activeLayerId,
}: {
  samples: SampleRecord[];
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [0, 0],
      zoom: 1,
    });
    map.addControl(new NavigationControl(), "top-left");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function syncLayers() {
      const visibleLayers = layers.filter((l) => visibleLayerIds.has(l.id));
      const wantedIds = new Set(visibleLayers.map((l) => l.id));

      // Remove sources/layers for anything no longer visible.
      for (const layer of layers) {
        if (wantedIds.has(layer.id)) continue;
        if (map!.getLayer(circleLayerId(layer.id))) map!.removeLayer(circleLayerId(layer.id));
        if (map!.getSource(sourceId(layer.id))) map!.removeSource(sourceId(layer.id));
      }

      const allCoords: [number, number][] = [];

      for (const layer of visibleLayers) {
        const data = toFeatureCollection(samples, layer.sampleIds);
        for (const f of data.features) allCoords.push(f.geometry.coordinates as [number, number]);

        const existing = map!.getSource(sourceId(layer.id)) as GeoJSONSource | undefined;
        if (existing) {
          existing.setData(data);
        } else {
          map!.addSource(sourceId(layer.id), { type: "geojson", data });
        }

        const isActive = layer.id === activeLayerId;
        if (!map!.getLayer(circleLayerId(layer.id))) {
          map!.addLayer({
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
        } else {
          map!.setPaintProperty(circleLayerId(layer.id), "circle-radius", isActive ? 7 : 5);
          map!.setPaintProperty(circleLayerId(layer.id), "circle-stroke-width", isActive ? 2 : 1);
        }
      }

      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(
          (b, coord) => b.extend(coord),
          new LngLatBounds(allCoords[0], allCoords[0])
        );
        map!.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 300 });
      }

      const interactiveLayerIds = visibleLayers.map((l) => circleLayerId(l.id));
      map!.getCanvas().style.cursor = "";
      map!.off("click", handleClick);
      map!.on("click", handleClick);

      function handleClick(e: MapMouseEvent) {
        const features = map!.queryRenderedFeatures(e.point, { layers: interactiveLayerIds });
        if (!features.length) return;
        const props = features[0].properties as { primary_identifier: string; species: string };
        popupRef.current?.remove();
        popupRef.current = new Popup({ closeButton: true })
          .setLngLat((features[0].geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-size:13px"><strong>${props.primary_identifier}</strong><br/>${props.species}</div>`
          )
          .addTo(map!);
      }
    }

    if (map.isStyleLoaded()) {
      syncLayers();
    } else {
      map.once("load", syncLayers);
    }
  }, [samples, layers, visibleLayerIds, activeLayerId]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}
