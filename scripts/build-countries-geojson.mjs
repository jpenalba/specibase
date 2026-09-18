// One-off build step: converts world-atlas's TopoJSON country boundaries
// into a plain GeoJSON file (scripts/data/countries-110m.geojson) — an
// intermediate input for build-plain-basemap-image.mjs, which rasterizes it
// into the actual "Plain" basemap image shipped in /public. Not used at
// runtime itself. Re-run this manually if world-atlas is ever upgraded, then
// re-run build-plain-basemap-image.mjs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as topojson from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(
  readFileSync(path.join(__dirname, "../node_modules/world-atlas/countries-110m.json"), "utf-8")
);

const geojson = topojson.feature(topology, topology.objects.countries);

mkdirSync(path.join(__dirname, "data"), { recursive: true });
const outPath = path.join(__dirname, "data/countries-110m.geojson");
writeFileSync(outPath, JSON.stringify(geojson));
console.log(`Wrote ${geojson.features.length} country features to ${outPath}`);
