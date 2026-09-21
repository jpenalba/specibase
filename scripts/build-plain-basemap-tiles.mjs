// One-off build step: rasterizes the Natural Earth country boundaries
// (scripts/data/countries-10m.geojson, produced by build-countries-geojson.mjs)
// into a standard XYZ raster tile pyramid for the "Plain" basemap — the
// same shape of source Streets/Satellite already use — rather than a live
// GeoJSON style (fill/line layers over a vector source): MapLibre's GeoJSON
// pipeline (parsing/tiling on a worker thread) hangs indefinitely in this
// app's Turbopack-bundled build (confirmed with Playwright, in both `next
// dev` and a production build, even with inline data and no network fetch
// involved) while the identical style renders fine outside of Next/
// Turbopack. Raster tiles sidestep that pipeline entirely.
//
// Two stacked raster sources, not one uniform pyramid:
//   - "world-base" (z0..BASE_MAX_ZOOM): full coverage, every tile rendered.
//     Cheap because at this shallow a zoom there just aren't many tiles.
//   - "world-detail" (BASE_MAX_ZOOM+1..DETAIL_MAX_ZOOM): only tiles that
//     actually have a piece of coastline/border running through them.
//     Everywhere else — the interior of a large landmass, the open ocean —
//     is skipped (no file) and left transparent, so world-base's z6 tile
//     (oversampled, but still just as solid a color, since oversampling a
//     solid fill has no visible artifact) shows through underneath. This
//     is what makes going several zoom levels deeper than the base layer
//     tractable: tile count scales with coastline *length*, not land
//     *area*, instead of with 4^zoom like a naive uniform pyramid would.
//
// Rendering itself also only feeds each tile the handful of country rings
// whose bounding box is anywhere near it, rather than one SVG path for
// every country on Earth cropped via viewBox — with 10m-resolution data
// (255 countries, ~540k coordinate points total, versus the 110m version's
// ~30k) re-rasterizing the *entire* combined path for every one of tens of
// thousands of tiles is the difference between this script finishing in
// minutes versus not finishing in hours. A tile next to a
// huge country's coastline (e.g. Russia) still pulls in that whole ring,
// since a ring can't be cut into pieces without breaking the fill (SVG
// fills a shape using its complete path, not just whatever's visible), but
// even that worst case renders in well under 100ms.
//
// Re-run this manually (`node scripts/build-countries-geojson.mjs && node
// scripts/build-plain-basemap-tiles.mjs`) if the source data or any of the
// zoom constants below ever change. Deletes and regenerates
// public/plain-tiles/ from scratch.
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

// Some sandboxed dev environments pre-install a Chromium binary outside
// Playwright's usual managed-browser location and expect it to be passed
// explicitly rather than downloaded; use it when present, otherwise fall
// back to Playwright's normal browser resolution (e.g. after a plain
// `npx playwright install`).
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geojson = JSON.parse(
  readFileSync(path.join(__dirname, "data/countries-10m.geojson"), "utf-8")
);

const BASE_MAX_ZOOM = 6;
const DETAIL_MAX_ZOOM = 9;
const TILE_SIZE = 256;
// A MapLibre "raster" source's tiles are placed by standard Web Mercator
// tile math — square, so the whole tile pyramid's pixel space (a single
// z0 tile scaled up by 2^DETAIL_MAX_ZOOM) is square too. Web Mercator is
// undefined at the poles (Y → ±∞), so latitude is clamped to the standard
// ±85.0511° limit — the same one Streets/Satellite are cut off at.
const LAT_LIMIT = 85.0511287798;
const WORLD_SIZE = TILE_SIZE * 2 ** DETAIL_MAX_ZOOM;
const mercatorY = (latDeg) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
const MERCATOR_Y_LIMIT = mercatorY(LAT_LIMIT);

function project([lng, lat]) {
  const clampedLat = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, lat));
  const x = ((lng + 180) / 360) * WORLD_SIZE;
  const y = ((MERCATOR_Y_LIMIT - mercatorY(clampedLat)) / (2 * MERCATOR_Y_LIMIT)) * WORLD_SIZE;
  return [x, y];
}

// Natural Earth rings can cross the antimeridian (e.g. Russia, Fiji, Alaska
// via the Aleutians), which would otherwise draw a spurious edge-to-edge
// line across the whole image. Split a ring into segments wherever two
// consecutive points jump more than 180° in longitude — treating the ring
// as circular (GeoJSON rings repeat their first point as their last, but
// the *real* coastline also wraps from the last distinct point back to the
// first one, and a crossing can fall exactly on that wraparound). Rotating
// to start right after a crossing avoids ever treating that wraparound as
// two unrelated pieces that a naive first-to-last scan would otherwise
// wrongly bridge with a straight line.
function ringToSegments(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const pts = ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
  if (pts.length < 2) return [];

  const isJump = (i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    return Math.abs(pts[i][0] - prev[0]) > 180;
  };
  let jumpIndex = -1;
  for (let i = 0; i < pts.length; i++) {
    if (isJump(i)) {
      jumpIndex = i;
      break;
    }
  }
  const rotated = jumpIndex <= 0 ? pts : [...pts.slice(jumpIndex), ...pts.slice(0, jumpIndex)];

  const segments = [[]];
  for (let i = 0; i < rotated.length; i++) {
    const point = rotated[i];
    const prev = rotated[i - 1];
    if (prev && Math.abs(point[0] - prev[0]) > 180) {
      segments.push([]);
    }
    segments[segments.length - 1].push(point);
  }
  return segments.filter((s) => s.length > 1);
}

function bboxOf(points) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

const segments = [];
for (const feature of geojson.features) {
  const geometry = feature.geometry;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const points of ringToSegments(ring)) segments.push(points);
    }
  }
}

// Each segment's own bounding box (loose — spans a country's full extent,
// interior included) and pre-projected path fragment, computed once and
// reused for every tile that needs it.
const segmentBBoxes = segments.map(bboxOf);
const segmentFragments = segments.map((points) => {
  const projected = points.map(project);
  return `M ${projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")} Z`;
});

// Spatial index (2°x2° cells) so "which segments are anywhere near this
// tile" is a lookup against a handful of cells instead of a scan of every
// segment for every tile — without it, both this check and the tighter
// outline-chunk check below are far too slow across tens of thousands of
// tiles.
const GRID_CELL_DEGREES = 2;
function cellKeysFor(bbox) {
  const cx0 = Math.floor(bbox.minLng / GRID_CELL_DEGREES);
  const cx1 = Math.floor(bbox.maxLng / GRID_CELL_DEGREES);
  const cy0 = Math.floor(bbox.minLat / GRID_CELL_DEGREES);
  const cy1 = Math.floor(bbox.maxLat / GRID_CELL_DEGREES);
  const keys = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) keys.push(`${cx},${cy}`);
  }
  return keys;
}

const segmentGrid = new Map();
segmentBBoxes.forEach((bbox, i) => {
  for (const key of cellKeysFor(bbox)) {
    if (!segmentGrid.has(key)) segmentGrid.set(key, []);
    segmentGrid.get(key).push(i);
  }
});

function tileLngLatBounds(z, x, y) {
  const n = 2 ** z;
  const lonLeft = (x / n) * 360 - 180;
  const lonRight = ((x + 1) / n) * 360 - 180;
  const toLat = (fy) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / n)));
  return { minLng: lonLeft, maxLng: lonRight, latTop: toLat(y), latBottom: toLat(y + 1) };
}

// Segments whose bounding box overlaps this tile at all — used both to
// decide whether the base layer needs a tile here (any land, interior
// included) and to pick which rings to actually feed the SVG for drawing.
function segmentsNear(tileBounds) {
  const found = new Set();
  for (const key of cellKeysFor({
    minLng: tileBounds.minLng,
    maxLng: tileBounds.maxLng,
    minLat: tileBounds.latBottom,
    maxLat: tileBounds.latTop,
  })) {
    const candidates = segmentGrid.get(key);
    if (!candidates) continue;
    for (const i of candidates) {
      const bbox = segmentBBoxes[i];
      if (
        bbox.minLng <= tileBounds.maxLng &&
        bbox.maxLng >= tileBounds.minLng &&
        bbox.minLat <= tileBounds.latTop &&
        bbox.maxLat >= tileBounds.latBottom
      ) {
        found.add(i);
      }
    }
  }
  return found;
}

// A whole ring segment's bounding box is a poor proxy for "is the actual
// outline near this tile" — a long, winding segment's bbox can span a huge
// area that's mostly nowhere near the line itself (this is fine for
// segmentsNear() above, which only needs to find candidates to draw, but
// it would flag nearly every tile within a large country's bbox as
// "bordering" and defeat the whole point of the detail layer, which
// should skip a large country's deep interior). Chopping into short
// chunks first keeps each bbox tight to the piece of coastline it
// actually covers, for this check specifically.
const CHUNK_POINTS = 12;
const outlineChunkGrid = new Map();
for (const points of segments) {
  for (let i = 0; i < points.length; i += CHUNK_POINTS - 1) {
    const chunk = points.slice(i, i + CHUNK_POINTS);
    if (chunk.length < 2) continue;
    const bbox = bboxOf(chunk);
    for (const key of cellKeysFor(bbox)) {
      if (!outlineChunkGrid.has(key)) outlineChunkGrid.set(key, []);
      outlineChunkGrid.get(key).push(bbox);
    }
  }
}

function nearOutline(tileBounds) {
  for (const key of cellKeysFor({
    minLng: tileBounds.minLng,
    maxLng: tileBounds.maxLng,
    minLat: tileBounds.latBottom,
    maxLat: tileBounds.latTop,
  })) {
    const candidates = outlineChunkGrid.get(key);
    if (!candidates) continue;
    for (const bbox of candidates) {
      if (
        bbox.minLng <= tileBounds.maxLng &&
        bbox.maxLng >= tileBounds.minLng &&
        bbox.minLat <= tileBounds.latTop &&
        bbox.maxLat >= tileBounds.latBottom
      ) {
        return true;
      }
    }
  }
  return false;
}

const outDir = path.join(__dirname, "../public/plain-tiles");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const scratchDir = mkdtempSync(path.join(tmpdir(), "plain-basemap-"));
const htmlPath = path.join(scratchDir, "plain-basemap.html");
writeFileSync(
  htmlPath,
  `<!doctype html><html><body style="margin:0;padding:0;">
<svg xmlns="http://www.w3.org/2000/svg" id="svg" width="${TILE_SIZE}" height="${TILE_SIZE}">
  <g id="fill" fill="#c9c9c2" stroke="#ffffff" stroke-linejoin="round">
    <path id="path" d="" />
  </g>
</svg>
</body></html>`
);

const browser = await chromium.launch(launchOptions);
let tileCount = 0;
const startTime = Date.now();
try {
  const page = await browser.newPage({ viewport: { width: TILE_SIZE, height: TILE_SIZE } });
  await page.goto(`file://${htmlPath}`);

  for (let z = 0; z <= DETAIL_MAX_ZOOM; z++) {
    const isBaseLevel = z <= BASE_MAX_ZOOM;
    const tileWorldSize = WORLD_SIZE / 2 ** z;
    // A stroke of a fixed width in these path coordinates would render at a
    // different *physical* thickness at every zoom level, since each level
    // crops a differently-sized chunk of the same WORLD_SIZE coordinate
    // space into the same TILE_SIZE pixels — scale it so borders stay a
    // consistent ~1.4px on screen everywhere.
    const strokeWidth = 1.4 * (tileWorldSize / TILE_SIZE);
    await page.evaluate(
      ({ sw }) => document.getElementById("fill").setAttribute("stroke-width", String(sw)),
      { sw: strokeWidth }
    );

    const zDir = path.join(outDir, String(z));
    const n = 2 ** z;
    let zTileCount = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const bounds = tileLngLatBounds(z, x, y);
        // Base layer: full coverage of every tile with any land in it
        // (interior included) — below z4 the count is tiny regardless, so
        // skip the check there and just render everything. Detail layer:
        // only tiles with actual coastline/border running through them —
        // see the module comment for why everywhere else (ocean, or deep
        // interior already covered by the base layer) is safe to skip.
        if (!isBaseLevel && !nearOutline(bounds)) continue;

        const nearby = segmentsNear(bounds);
        if (isBaseLevel && z >= 4 && nearby.size === 0) continue;
        const d = [...nearby].map((i) => segmentFragments[i]).join(" ");

        await page.evaluate(
          ({ left, top, size, d }) => {
            document.getElementById("path").setAttribute("d", d);
            document.getElementById("svg").setAttribute("viewBox", `${left} ${top} ${size} ${size}`);
          },
          { left: x * tileWorldSize, top: y * tileWorldSize, size: tileWorldSize, d }
        );

        mkdirSync(path.join(zDir, String(x)), { recursive: true });
        await page.screenshot({ path: path.join(zDir, String(x), `${y}.png`) });
        tileCount++;
        zTileCount++;
      }
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`z${z}: ${zTileCount} tiles (${tileCount} total so far, ${elapsed}s elapsed)`);
  }
} finally {
  await browser.close();
  rmSync(scratchDir, { recursive: true, force: true });
}

console.log(
  `Wrote ${tileCount} tiles to ${outDir} (base 0-${BASE_MAX_ZOOM}, detail ${BASE_MAX_ZOOM + 1}-${DETAIL_MAX_ZOOM}) from ${geojson.features.length} country features`
);
