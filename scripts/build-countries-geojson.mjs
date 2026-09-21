// One-off build step: converts world-atlas's TopoJSON country boundaries
// into a plain GeoJSON file (scripts/data/countries-10m.geojson) — an
// intermediate input for build-plain-basemap-tiles.mjs, which rasterizes it
// into the actual "Plain" basemap tiles shipped in /public. Not used at
// runtime itself.
//
// Uses world-atlas's 10m (1:10,000,000) resolution, not its coarser 50m or
// 110m files: at 110m, coastlines are simplified enough that samples
// collected right on a real coastline can end up looking like they're
// sitting in the ocean on this basemap, purely from the simplification —
// 10m is close enough to the real coastline that this stops happening.
//
// Re-run this manually if world-atlas is ever upgraded, then re-run
// build-plain-basemap-tiles.mjs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as topojson from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(
  readFileSync(path.join(__dirname, "../node_modules/world-atlas/countries-10m.json"), "utf-8")
);

const geojson = topojson.feature(topology, topology.objects.countries);

mkdirSync(path.join(__dirname, "data"), { recursive: true });
const outPath = path.join(__dirname, "data/countries-10m.geojson");
writeFileSync(outPath, JSON.stringify(geojson));
console.log(`Wrote ${geojson.features.length} country features to ${outPath}`);
