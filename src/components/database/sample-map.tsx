"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl, LngLatBounds } from "maplibre-gl";
import { SampleRecord } from "@/lib/samples-store";
import { MapLayer } from "@/lib/layers";
import { FieldDef } from "@/lib/fields";
import { formatToDDMMYYYY } from "@/lib/dates";

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

function pointFor(s: SampleRecord): [number, number] | null {
  const lat = Number(s.latitude);
  const lon = Number(s.longitude);
  if (s.latitude == null || s.longitude == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return [lon, lat];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shows the same fields currently visible in the table below, not just
// ID/species — explicit dark colors throughout, since the popup renders
// on its own white bubble regardless of the app's light/dark theme, and
// leaving color unset here read as too-light gray to read comfortably.
function buildPopupHtml(sample: SampleRecord, columns: FieldDef[]): string {
  const rows = columns
    .map((col) => {
      const raw = sample[col.key];
      const display =
        raw === undefined || raw === null || raw === ""
          ? "—"
          : col.type === "date"
            ? formatToDDMMYYYY(String(raw))
            : String(raw);
      return `<div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0;">
        <span style="color:#52514e;">${escapeHtml(col.label)}</span>
        <span style="color:#0b0b0b;font-weight:500;text-align:right;">${escapeHtml(display)}</span>
      </div>`;
    })
    .join("");
  return `<div style="font-size:13px;min-width:200px;">${rows}</div>`;
}

export function SampleMap({
  samples,
  layers,
  visibleLayerIds,
  activeLayerId,
  popupColumns,
  onSyncError,
}: {
  samples: SampleRecord[];
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
  activeLayerId: string;
  // Fields shown when a point is clicked — pass the same columns visible
  // in the table so a marker's popup and the table row agree.
  popupColumns: FieldDef[];
  // Surfaces map-internal problems directly on the page instead of only
  // in the browser console — most people using this app won't have
  // DevTools open.
  onSyncError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lastCoordsRef = useRef<[number, number][]>([]);

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
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      // Markers are plain DOM elements positioned by MapLibre, not a WebGL
      // style layer — simplest to just clear and rebuild them all rather
      // than diff which ones changed.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const coords: [number, number][] = [];

      for (const layer of layers) {
        if (!visibleLayerIds.has(layer.id)) continue;
        const isActive = layer.id === activeLayerId;

        for (const sample of samples) {
          if (!layer.sampleIds.has(sample.id)) continue;
          const point = pointFor(sample);
          if (!point) continue;
          coords.push(point);

          const el = document.createElement("div");
          const size = isActive ? 16 : 12;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = "50%";
          el.style.backgroundColor = layer.color;
          el.style.border = "2px solid #ffffff";
          el.style.boxShadow = "0 0 2px rgba(0,0,0,0.5)";
          el.style.cursor = "pointer";

          const popup = new Popup({ offset: size / 2 + 4, closeButton: true }).setHTML(
            buildPopupHtml(sample, popupColumns)
          );

          const marker = new Marker({ element: el })
            .setLngLat(point)
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }
      }

      lastCoordsRef.current = coords;

      if (coords.length > 0) {
        map.resize();
        const bounds = coords.reduce(
          (b, coord) => b.extend(coord),
          new LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 300 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown map error";
      console.error("Failed to place map markers", error);
      onSyncError?.(message);
    }
  }, [samples, layers, visibleLayerIds, activeLayerId, popupColumns, onSyncError]);

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
