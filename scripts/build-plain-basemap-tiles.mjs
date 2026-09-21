// One-off build step: rasterizes the Natural Earth country boundaries
// (scripts/data/countries-110m.geojson, produced by
// build-countries-geojson.mjs) into a standard XYZ raster tile pyramid for
// the "Plain" basemap, the same shape of source Streets/Satellite already
// use (public/plain-tiles/{z}/{x}/{y}.png), rather than one static image.
//
// A single image (an earlier version of this basemap) necessarily has a
// fixed pixel resolution, so it visibly pixelates once the map is zoomed in
// past whatever that resolution was rendered at — real tiles avoid this the
// same way Streets/Satellite do, by having actual higher-resolution images
// available at deeper zoom levels instead of stretching one fixed image.
//
// This still isn't a live GeoJSON style (fill/line layers over a vector
// source): MapLibre's GeoJSON pipeline (parsing/tiling on a worker thread)
// hangs indefinitely in this app's Turbopack-bundled build (confirmed with
// Playwright, in both `next dev` and a production build, even with inline
// data and no network fetch involved) while the identical style renders
// fine outside of Next/Turbopack. Raster tiles sidestep that pipeline
// entirely — plain image fetches on the main thread, no worker involved.
//
// Re-run this manually (`node scripts/build-countries-geojson.mjs && node
// scripts/build-plain-basemap-tiles.mjs`) if the source data or MAX_ZOOM
// ever changes. Deletes and regenerates public/plain-tiles/ from scratch.
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
  readFileSync(path.join(__dirname, "data/countries-110m.geojson"), "utf-8")
);

// Deeper than this, the underlying 110m-simplified coastlines have no more
// real detail to show anyway (MapLibre just oversamples the z6 tile past
// this, the same graceful degradation Satellite gets past its own source's
// max zoom) — going deeper mainly multiplies tile count, not visible
// quality, for what's meant to stay a plain background layer.
const MAX_ZOOM = 6;
const TILE_SIZE = 256;
// A MapLibre "raster" source's tiles are placed by standard Web Mercator
// tile math — square, so the whole tile pyramid's pixel space (a single
// z0 tile scaled up by 2^MAX_ZOOM) is square too. Web Mercator is undefined
// at the poles (Y → ±∞), so latitude is clamped to the standard ±85.0511°
// limit — the same one Streets/Satellite are cut off at.
const LAT_LIMIT = 85.0511287798;
const WORLD_SIZE = TILE_SIZE * 2 ** MAX_ZOOM;
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

function segmentBBox(points) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

// One entry per antimeridian-split ring segment: the raw lng/lat points
// (for the land-overlap bbox test below) and the already-projected pixel
// path data (for drawing, at the single fixed WORLD_SIZE resolution — every
// zoom level's tiles are just a crop of the same vector paths, so this is
// computed once and reused for all of them).
const segments = [];
for (const feature of geojson.features) {
  const geometry = feature.geometry;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const points of ringToSegments(ring)) {
        segments.push({ bbox: segmentBBox(points), points });
      }
    }
  }
}

const pathData = segments
  .map(({ points }) => {
    const projected = points.map(project);
    return `M ${projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")} Z`;
  })
  .join(" ");

function tileLngLatBounds(z, x, y) {
  const n = 2 ** z;
  const lonLeft = (x / n) * 360 - 180;
  const lonRight = ((x + 1) / n) * 360 - 180;
  const toLat = (fy) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / n)));
  return { lonLeft, lonRight, latTop: toLat(y), latBottom: toLat(y + 1) };
}

function overlapsLand(tileBounds) {
  return segments.some(
    ({ bbox }) =>
      bbox.minLng <= tileBounds.lonRight &&
      bbox.maxLng >= tileBounds.lonLeft &&
      bbox.minLat <= tileBounds.latTop &&
      bbox.maxLat >= tileBounds.latBottom
  );
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
    <path d="${pathData}" />
  </g>
</svg>
</body></html>`
);

const browser = await chromium.launch(launchOptions);
let tileCount = 0;
try {
  const page = await browser.newPage({ viewport: { width: TILE_SIZE, height: TILE_SIZE } });
  await page.goto(`file://${htmlPath}`);

  for (let z = 0; z <= MAX_ZOOM; z++) {
    const tileWorldSize = WORLD_SIZE / 2 ** z;
    // A stroke of a fixed width in these path coordinates would render at a
    // different *physical* thickness at every zoom level, since each level
    // crops a differently-sized chunk of the same WORLD_SIZE coordinate
    // space into the same TILE_SIZE pixels — scale it so borders stay a
    // consistent ~1.4px on screen everywhere, matching how the previous
    // single-image version looked at its native resolution.
    const strokeWidth = 1.4 * (tileWorldSize / TILE_SIZE);
    await page.evaluate(
      ({ sw }) => document.getElementById("fill").setAttribute("stroke-width", String(sw)),
      { sw: strokeWidth }
    );

    const zDir = path.join(outDir, String(z));
    const n = 2 ** z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        // Below z4 the tile count is tiny (≤64) regardless — skip the
        // overlap check there and just render everything, since checking
        // costs more than it'd ever save at that size.
        if (z >= 4 && !overlapsLand(tileLngLatBounds(z, x, y))) continue;

        await page.evaluate(
          ({ left, top, size }) =>
            document.getElementById("svg").setAttribute("viewBox", `${left} ${top} ${size} ${size}`),
          { left: x * tileWorldSize, top: y * tileWorldSize, size: tileWorldSize }
        );

        mkdirSync(path.join(zDir, String(x)), { recursive: true });
        await page.screenshot({ path: path.join(zDir, String(x), `${y}.png`) });
        tileCount++;
      }
    }
    console.log(`z${z}: done (${tileCount} tiles so far)`);
  }
} finally {
  await browser.close();
  rmSync(scratchDir, { recursive: true, force: true });
}

console.log(`Wrote ${tileCount} tiles to ${outDir} (maxzoom ${MAX_ZOOM}) from ${geojson.features.length} country features`);
