"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl, LngLatBounds } from "maplibre-gl";
import { SampleRecord } from "@/lib/samples-store";
import { MapLayer, ALL_LAYER_ID } from "@/lib/layers";
import { LayerShape, shapePolygonPoints } from "@/lib/layer-shapes";
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
    // A pre-rendered raster tile pyramid (gray countries, white borders,
    // white ocean, from 10m-resolution Natural Earth boundaries — see
    // scripts/build-plain-basemap-tiles.mjs), the same shape of source as
    // Streets/Satellite, rather than a single static image or a live
    // GeoJSON source styled with fill/line layers:
    // - A single image pixelates once zoomed in past its fixed resolution;
    //   real tiles avoid that by having sharper images at deeper zooms,
    //   same as any other raster basemap.
    // - MapLibre's normal way of drawing vector boundaries (a GeoJSON
    //   source plus fill/line layers) relies on its worker pipeline
    //   (parsing/tiling off the main thread), and that pipeline hangs
    //   indefinitely in this app's Turbopack-bundled build — confirmed with
    //   Playwright to reproduce identically in `next dev` and a production
    //   build, even with inline data and no network fetch involved, while
    //   the identical style renders fine outside of Next/Turbopack. Raster
    //   tiles sidestep that pipeline entirely (plain image fetches, no
    //   worker), which is also why Streets and Satellite were never
    //   affected by this bug.
    //
    // Two stacked raster sources rather than one uniform pyramid — see the
    // build script's module comment for the full reasoning: "world-base"
    // covers the whole world up to zoom 6, and "world-detail" only exists
    // where real coastline/border runs through a tile, letting it go much
    // deeper (zoom 9) without a 4^zoom explosion of ocean/interior tiles.
    // world-base's z6 tile just oversamples underneath wherever world-detail
    // has no tile, which is invisible for a solid fill.
    attribution: "Natural Earth",
    style: {
      version: 8,
      sources: {
        "world-base": {
          type: "raster",
          tiles: ["/plain-tiles/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 6,
        },
        "world-detail": {
          type: "raster",
          tiles: ["/plain-tiles/{z}/{x}/{y}.png"],
          tileSize: 256,
          minzoom: 7,
          maxzoom: 9,
        },
      },
      layers: [
        // Tiles that don't exist (pure ocean/deep interior, skipped at
        // build time to avoid generating and shipping every possible tile)
        // 404 and render nothing, so the layer(s) beneath show through —
        // down to this background color for open ocean.
        { id: "water", type: "background", paint: { "background-color": "#ffffff" } },
        { id: "world-base", type: "raster", source: "world-base" },
        { id: "world-detail", type: "raster", source: "world-detail" },
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

type PointInfo = {
  sample: SampleRecord;
  point: [number, number];
  color: string;
  shape: LayerShape;
  // Base marker size (not yet bumped for highlighting) — see displaySize().
  size: number;
  isHighlighted: boolean;
};

// Shared by the marker-rendering effect and the PDF export, so what gets
// drawn on screen and what gets drawn into the exported image can't drift
// apart into two different lists of points.
function computeVisiblePoints(
  samples: SampleRecord[],
  layers: MapLayer[],
  visibleLayerIds: Set<string>,
  hiddenSampleIds: Set<string>,
  highlightedSampleId: string | null
): PointInfo[] {
  const points: PointInfo[] = [];
  for (const layer of layers) {
    if (!visibleLayerIds.has(layer.id)) continue;
    // Project layers draw larger than the main database, so a project's
    // samples stand out against the full set of points beneath them.
    const isMainDatabase = layer.id === ALL_LAYER_ID;
    for (const sample of samples) {
      if (!layer.sampleIds.has(sample.id)) continue;
      if (hiddenSampleIds.has(sample.id)) continue;
      const point = pointFor(sample);
      if (!point) continue;
      points.push({
        sample,
        point,
        color: layer.color,
        shape: layer.shape,
        size: isMainDatabase ? 12 : 16,
        isHighlighted: sample.id === highlightedSampleId,
      });
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

// A distinct ring color for whichever marker is highlighted (from clicking
// its row in the table) — amber reads clearly against every layer color and
// both basemap tones, without being confused for a layer's own color.
const HIGHLIGHT_RING_COLOR = "#f59e0b";

function displaySize(baseSize: number, highlighted: boolean): number {
  return highlighted ? baseSize + 8 : baseSize;
}

// Builds the marker's fill+stroke as an inline SVG rather than drawing the
// shape with CSS (border-radius, clip-path, etc.) — a single technique
// that covers every shape uniformly, circle included, instead of a
// different CSS trick per shape.
function markerShapeSvg(shape: LayerShape, color: string, size: number, highlighted: boolean): string {
  const strokeWidth = highlighted ? 3 : 2;
  const strokeColor = highlighted ? HIGHLIGHT_RING_COLOR : "#ffffff";
  const padding = strokeWidth / 2 + 1;
  const half = size / 2;
  const shapeMarkup =
    shape === "circle"
      ? `<circle cx="${half}" cy="${half}" r="${half - padding}" />`
      : `<polygon points="${shapePolygonPoints(shape, size, padding)!.map(([x, y]) => `${x},${y}`).join(" ")}" />`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
    <g fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round">${shapeMarkup}</g>
  </svg>`;
}

function applyMarkerStyle(
  el: HTMLDivElement,
  shape: LayerShape,
  color: string,
  baseSize: number,
  highlighted: boolean
) {
  const size = displaySize(baseSize, highlighted);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.zIndex = highlighted ? "10" : "";
  el.innerHTML = markerShapeSvg(shape, color, size, highlighted);
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
  popupColumns,
  onSyncError,
  hiddenSampleIds,
  highlightedSampleId,
}: {
  samples: SampleRecord[];
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
  // Fields shown when a point is clicked — pass the same columns visible
  // in the table so a marker's popup and the table row agree.
  popupColumns: FieldDef[];
  // Surfaces map-internal problems directly on the page instead of only
  // in the browser console — most people using this app won't have
  // DevTools open.
  onSyncError?: (message: string) => void;
  // Samples unticked in the table's per-row checkbox — excluded from the
  // map (and the PDF export) entirely, same set regardless of active layer.
  hiddenSampleIds: Set<string>;
  // The sample whose table row was last clicked — its marker is drawn
  // larger with a highlight ring, and the map pans/zooms to it.
  highlightedSampleId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Tracks each marker's sample id, shape/color, and base (non-highlighted)
  // size alongside the Marker/element itself, so the highlight effect below
  // can restyle the one marker that changed without rebuilding the whole set.
  const markersRef = useRef<
    { id: string; marker: Marker; el: HTMLDivElement; shape: LayerShape; color: string; baseSize: number }[]
  >([]);
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
  // Mirrors the highlightedSampleId prop for syncMarkers to read without
  // needing it in that effect's dependency array — highlighting a row
  // shouldn't rebuild every marker and re-fit the map bounds (see the
  // highlight effect below, which restyles just the one marker instead).
  const highlightedIdRef = useRef<string | null>(null);

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
      markersRef.current.forEach(({ marker }) => marker.remove());
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
        markersRef.current.forEach(({ marker }) => marker.remove());
        markersRef.current = [];

        const points = computeVisiblePoints(
          samples,
          layers,
          visibleLayerIds,
          hiddenSampleIds,
          highlightedIdRef.current
        );
        const coords: [number, number][] = [];

        for (const { sample, point, color, shape, size, isHighlighted } of points) {
          coords.push(point);

          const el = document.createElement("div");
          el.style.cursor = "pointer";
          applyMarkerStyle(el, shape, color, size, isHighlighted);

          const popup = new Popup({
            offset: displaySize(size, isHighlighted) / 2 + 4,
            closeButton: true,
          }).setHTML(buildPopupHtml(sample, popupColumns));

          const marker = new Marker({ element: el }).setLngLat(point).setPopup(popup).addTo(map);
          markersRef.current.push({ id: sample.id, marker, el, shape, color, baseSize: size });
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
  }, [samples, layers, visibleLayerIds, hiddenSampleIds, popupColumns, onSyncError]);

  // Restyles just the previously/newly highlighted marker in place, and
  // pans/zooms to the new one — deliberately not folded into the effect
  // above, since clicking a table row shouldn't rebuild every marker and
  // re-fit the map to all of them.
  useEffect(() => {
    highlightedIdRef.current = highlightedSampleId;
    const map = mapRef.current;
    if (!map) return;

    for (const entry of markersRef.current) {
      applyMarkerStyle(entry.el, entry.shape, entry.color, entry.baseSize, entry.id === highlightedSampleId);
    }

    if (highlightedSampleId && styleReadyRef.current) {
      const sample = samples.find((s) => s.id === highlightedSampleId);
      const point = sample ? pointFor(sample) : null;
      if (point) {
        map.flyTo({ center: point, zoom: Math.max(map.getZoom(), 6), duration: 600 });
      }
    }
  }, [highlightedSampleId, samples]);

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
      // actually on screen (hidden samples excluded, the highlighted one
      // drawn with the same ring it has on screen).
      const points = computeVisiblePoints(
        samples,
        layers,
        visibleLayerIds,
        hiddenSampleIds,
        highlightedIdRef.current
      );
      for (const { point, color, shape, size, isHighlighted } of points) {
        const projected = map.project(point);
        const x = projected.x * dpr;
        const y = projected.y * dpr;
        const drawSize = displaySize(size, isHighlighted) * dpr;
        const strokeWidth = (isHighlighted ? 3 : 2) * dpr;
        const padding = strokeWidth / 2 + dpr;

        ctx.fillStyle = color;
        ctx.strokeStyle = isHighlighted ? HIGHLIGHT_RING_COLOR : "#ffffff";
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (shape === "circle") {
          ctx.arc(x, y, drawSize / 2 - padding, 0, Math.PI * 2);
        } else {
          const offset = drawSize / 2;
          shapePolygonPoints(shape, drawSize, padding)!.forEach(([px, py], i) => {
            const vx = x - offset + px;
            const vy = y - offset + py;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          });
          ctx.closePath();
        }
        ctx.fill();
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
      const legendMarkerSize = 8;
      for (const layer of legendLayers) {
        const [r, g, b] = hexToRgb(layer.color);
        doc.setFillColor(r, g, b);
        const cx = margin + 4;
        const cy = legendY - 3;
        if (layer.shape === "circle") {
          doc.circle(cx, cy, legendMarkerSize / 2, "F");
        } else {
          const half = legendMarkerSize / 2;
          const points = shapePolygonPoints(layer.shape, legendMarkerSize, 0)!.map(
            ([px, py]) => [cx - half + px, cy - half + py] as [number, number]
          );
          const deltas = points.slice(1).map(([px, py], i) => [px - points[i][0], py - points[i][1]]);
          doc.lines(deltas, points[0][0], points[0][1], [1, 1], "F", true);
        }
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
