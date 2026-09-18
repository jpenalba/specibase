"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl, LngLatBounds } from "maplibre-gl";
import { SampleRecord } from "@/lib/samples-store";
import { MapLayer } from "@/lib/layers";
import { FieldDef } from "@/lib/fields";
import { formatToDDMMYYYY } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Neither of these needs an API key, which matters for a lab tool that
// should run the moment it's deployed — but neither is meant for heavy
// production traffic. Switch to a proper keyed provider (MapTiler, Stadia
// Maps, Mapbox) if this gets real day-to-day use.
const STREETS_SOURCE = {
  type: "raster" as const,
  tiles: [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  tileSize: 256,
  // A plain "©" rather than the HTML entity "&copy;" — this string is used
  // both in MapLibre's on-page attribution control (which renders HTML)
  // and as plain text in the PDF export, and jsPDF doesn't decode entities.
  attribution: "© OpenStreetMap contributors",
};
const SATELLITE_SOURCE = {
  type: "raster" as const,
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

type BasemapId = "streets" | "satellite" | "plain";

const BASEMAPS: Record<
  BasemapId,
  { label: string; attribution: string; style: object }
> = {
  streets: {
    label: "Streets",
    attribution: STREETS_SOURCE.attribution,
    style: {
      version: 8,
      sources: { base: STREETS_SOURCE },
      layers: [{ id: "base", type: "raster", source: "base" }],
    },
  },
  satellite: {
    label: "Satellite",
    attribution: SATELLITE_SOURCE.attribution,
    style: {
      version: 8,
      sources: { base: SATELLITE_SOURCE },
      layers: [{ id: "base", type: "raster", source: "base" }],
    },
  },
  plain: {
    label: "Plain",
    // A single pre-rendered world image (gray countries, white borders,
    // white ocean — see scripts/build-plain-basemap-image.mjs) rather than
    // a live GeoJSON source styled with fill/line layers. MapLibre's normal
    // way of drawing vector boundaries relies on its worker pipeline
    // (parsing and tiling happen off the main thread), and that pipeline
    // hangs indefinitely in this app's Turbopack-bundled build — confirmed
    // with Playwright to reproduce identically in both `next dev` and a
    // production `next build && next start`, even with inline GeoJSON data
    // and no network fetch involved, while the exact same style renders
    // fine outside of Next/Turbopack. A raster image source sidesteps that
    // pipeline entirely (no worker involved), which is also why Streets and
    // Satellite — both raster — were never affected by this bug.
    attribution: "Natural Earth",
    style: {
      version: 8,
      sources: {
        world: {
          type: "image",
          url: "/plain-basemap.png",
          // Corners in order: top-left, top-right, bottom-right, bottom-left.
          // Clamped to ±85.0511° (the standard Web Mercator latitude limit)
          // rather than the poles: Mercator's Y coordinate goes to infinity
          // at ±90°, which MapLibre rejects outright ("outside of bounds")
          // for an image source's corners. The image itself still covers
          // the full ±90° vertically, so this just crops a sliver of
          // Antarctica/the Arctic Ocean that no web map projection can
          // show anyway.
          coordinates: [
            [-180, 85.0511],
            [180, 85.0511],
            [180, -85.0511],
            [-180, -85.0511],
          ],
        },
      },
      layers: [
        { id: "water", type: "background", paint: { "background-color": "#ffffff" } },
        { id: "world", type: "raster", source: "world" },
      ],
    },
  },
};

function pointFor(s: SampleRecord): [number, number] | null {
  const lat = Number(s.latitude);
  const lon = Number(s.longitude);
  if (s.latitude == null || s.longitude == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return [lon, lat];
}

type PointInfo = { sample: SampleRecord; point: [number, number]; color: string; size: number };

// Shared by the marker-rendering effect and the PDF export, so what gets
// drawn on screen and what gets drawn into the exported image can't drift
// apart into two different lists of points.
function computeVisiblePoints(
  samples: SampleRecord[],
  layers: MapLayer[],
  visibleLayerIds: Set<string>,
  activeLayerId: string
): PointInfo[] {
  const points: PointInfo[] = [];
  for (const layer of layers) {
    if (!visibleLayerIds.has(layer.id)) continue;
    const isActive = layer.id === activeLayerId;
    for (const sample of samples) {
      if (!layer.sampleIds.has(sample.id)) continue;
      const point = pointFor(sample);
      if (!point) continue;
      points.push({ sample, point, color: layer.color, size: isActive ? 16 : 12 });
    }
  }
  return points;
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

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
    : [0, 0, 0];
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
  const [basemap, setBasemap] = useState<BasemapId>("streets");
  const [exporting, setExporting] = useState(false);

  // Set once the map's current style is fully loaded (initial mount, and
  // again after every basemap switch); false while a style swap is still
  // in flight. Lets the marker effect below know whether it's safe to place
  // markers now or must wait.
  const styleReadyRef = useRef(false);
  // Always points at the latest marker-placement closure, called once the
  // current style becomes ready (which can happen before or after that
  // closure was last updated).
  const latestSyncMarkersRef = useRef<() => void>(() => {});
  // Tracks the basemap the map's style was last set to, so the basemap
  // effect (below) can skip calling setStyle() on first mount — the
  // constructor already applied the initial style — and only swap styles
  // on an actual change.
  const currentStyleIdRef = useRef<BasemapId | null>(null);

  // Creates the map exactly once, on mount, and never destroys it until
  // unmount. Basemap switches are handled by a separate effect that calls
  // setStyle() on this same instance (see below) rather than tearing the
  // map down and rebuilding it — a single long-lived instance avoids the
  // churn of repeatedly constructing/destroying MapLibre's internal state.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAPS[basemap].style as ConstructorParameters<typeof MapLibreMap>[0]["style"],
      center: [0, 0],
      zoom: 1,
      // Needed to read the canvas back out as an image for PDF export —
      // WebGL clears its buffer after each frame by default, which would
      // otherwise make toDataURL() return a blank image most of the time.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    currentStyleIdRef.current = basemap;
    map.addControl(new NavigationControl(), "top-left");
    map.on("error", (e) => {
      // Individual tile fetch failures are routine (flaky network, a
      // blocked host) and not a Specibase-level problem — only report
      // genuine style/rendering errors.
      if (e.error?.message?.includes("AJAXError")) return;
      console.error("MapLibre error", e.error);
      onSyncError?.(e.error?.message ?? "Unknown map error");
    });
    // "load" only ever fires once per map instance (the very first style
    // load); every later basemap switch is picked up by "idle" instead,
    // which fires whenever the map settles after any change, including a
    // setStyle() call — see the basemap-switch effect below.
    map.on("load", () => {
      styleReadyRef.current = true;
      map.resize();
      latestSyncMarkersRef.current();
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
    // Deliberately empty: this effect must run exactly once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swaps the live style in place when the user picks a different basemap,
  // instead of tearing the map down (see the mount effect above for why).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleIdRef.current === basemap) return;

    styleReadyRef.current = false;
    currentStyleIdRef.current = basemap;
    map.setStyle(BASEMAPS[basemap].style as Parameters<typeof map.setStyle>[0]);
    map.once("idle", () => {
      styleReadyRef.current = true;
      latestSyncMarkersRef.current();
    });
  }, [basemap]);

  useEffect(() => {
    function syncMarkers() {
      const map = mapRef.current;
      if (!map) return;

      try {
        // Markers are plain DOM elements positioned by MapLibre, not a
        // WebGL style layer — simplest to just clear and rebuild them all
        // rather than diff which ones changed.
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const points = computeVisiblePoints(samples, layers, visibleLayerIds, activeLayerId);
        const coords: [number, number][] = [];

        for (const { sample, point, color, size } of points) {
          coords.push(point);

          const el = document.createElement("div");
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = "50%";
          el.style.backgroundColor = color;
          el.style.border = "2px solid #ffffff";
          el.style.boxShadow = "0 0 2px rgba(0,0,0,0.5)";
          el.style.cursor = "pointer";

          const popup = new Popup({ offset: size / 2 + 4, closeButton: true }).setHTML(
            buildPopupHtml(sample, popupColumns)
          );

          const marker = new Marker({ element: el }).setLngLat(point).setPopup(popup).addTo(map);
          markersRef.current.push(marker);
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
    }

    latestSyncMarkersRef.current = syncMarkers;
    if (styleReadyRef.current) {
      syncMarkers();
    }
    // If a style swap is still in flight (initial mount's "load", or a
    // basemap switch's "idle" — see the effects above), that handler will
    // call latestSyncMarkersRef.current() — which by then points at this
    // run's syncMarkers — once the style settles.
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

  async function exportPdf() {
    const map = mapRef.current;
    if (!map) return;
    setExporting(true);
    try {
      // Force a fresh frame before reading the canvas back out, otherwise
      // a stale or partially-cleared buffer can get captured.
      map.triggerRepaint();
      await new Promise((resolve) => map.once("render", resolve));

      const mapCanvas = map.getCanvas();
      const dpr = window.devicePixelRatio || 1;
      const width = mapCanvas.width;
      const height = mapCanvas.height;

      const composite = document.createElement("canvas");
      composite.width = width;
      composite.height = height;
      const ctx = composite.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported in this browser");
      ctx.drawImage(mapCanvas, 0, 0, width, height);

      // Markers are DOM elements, invisible to the WebGL canvas — redrawn
      // here at their true projected position so the export matches what's
      // actually on screen.
      const points = computeVisiblePoints(samples, layers, visibleLayerIds, activeLayerId);
      for (const { point, color, size } of points) {
        const projected = map.project(point);
        const x = projected.x * dpr;
        const y = projected.y * dpr;
        const radius = (size / 2) * dpr;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }

      const imageData = composite.toDataURL("image/png");

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 32;

      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text("Specibase — map export", margin, margin);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(new Date().toLocaleString(), margin, margin + 14);

      const imageTop = margin + 28;
      const legendLayers = layers.filter((l) => visibleLayerIds.has(l.id));
      const legendHeight = 16 + legendLayers.length * 14;
      const maxImgWidth = pageWidth - margin * 2;
      const maxImgHeight = pageHeight - imageTop - margin - legendHeight;
      const scale = Math.min(maxImgWidth / width, maxImgHeight / height);
      const imgWidth = width * scale;
      const imgHeight = height * scale;

      doc.addImage(imageData, "PNG", margin, imageTop, imgWidth, imgHeight);

      let legendY = imageTop + imgHeight + 20;
      doc.setFontSize(9);
      for (const layer of legendLayers) {
        const [r, g, b] = hexToRgb(layer.color);
        doc.setFillColor(r, g, b);
        doc.circle(margin + 4, legendY - 3, 4, "F");
        doc.setTextColor(30, 30, 30);
        doc.text(`${layer.label} (${layer.sampleIds.size})`, margin + 14, legendY);
        legendY += 14;
      }

      const attribution = BASEMAPS[basemap].attribution;
      if (attribution) {
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text(attribution, margin, pageHeight - 12);
      }

      doc.save(`specibase-map-${Date.now()}.pdf`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error";
      console.error("Failed to export map to PDF", error);
      onSyncError?.(`Export failed: ${message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-lg" />

      <div className="absolute top-2 right-2 z-10 flex overflow-hidden rounded-md border border-border bg-card shadow-sm">
        {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setBasemap(id)}
            className={cn(
              "px-2 py-1 text-xs",
              basemap === id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {BASEMAPS[id].label}
          </button>
        ))}
      </div>

      <div className="absolute right-2 bottom-8 z-10 flex gap-2">
        <Button variant="outline" size="sm" onClick={fitToData} className="bg-card shadow-sm">
          Fit to data
        </Button>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting} className="bg-card shadow-sm">
          {exporting ? "Exporting..." : "Export PDF"}
        </Button>
      </div>
    </div>
  );
}
