// One-off build step: rasterizes the Natural Earth country boundaries
// (scripts/data/countries-110m.geojson, produced by
// build-countries-geojson.mjs) into a single flat world image for the
// "Plain" basemap.
//
// This exists because MapLibre's normal way of styling vector boundaries —
// a GeoJSON source plus fill/line layers — depends on MapLibre's worker
// pipeline (GeoJSON parsing and tiling happens off the main thread). That
// pipeline silently hangs forever in this app's Turbopack-bundled build
// (confirmed with Playwright: the source never leaves "loading", even with
// inline data and no network fetch involved, in both `next dev` and a
// production `next build && next start`), while the exact same style JSON
// renders correctly outside of Next/Turbopack. Baking the boundaries into a
// plain raster image sidesteps that pipeline entirely — a raster/image
// source is just a texture, no worker involved, which is why Streets and
// Satellite (also raster) were never affected by this bug.
//
// Re-run this manually (`node scripts/build-countries-geojson.mjs && node
// scripts/build-plain-basemap-image.mjs`) if the source data ever changes.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
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

// A MapLibre "image" source does NOT reproject its pixels per-latitude —
// it converts the four given corners to Mercator space and stretches the
// image linearly between them as a flat quad (see maplibre-gl's
// ImageSource.setCoordinates(), which maps each corner through
// MercatorCoordinate.fromLngLat and never touches the pixels in between).
// So the image itself has to already be Mercator-projected for its content
// to land on the same lat/lng as everything else on the map (the sample
// markers included) — a plain linear/equirectangular image would end up
// vertically compressed relative to true Mercator, which is exactly the
// "points don't land in the right place" bug this replaced. Web Mercator is
// undefined at the poles (Y → ±∞), so both the image and the source's
// corner coordinates are clamped to the standard ±85.0511° limit — the same
// latitude every other Mercator web map (and Streets/Satellite here) is cut
// off at, which is also exactly where the Mercator Y range becomes square
// with the longitude range, hence the square canvas below.
const LAT_LIMIT = 85.0511287798;
const WIDTH = 4096;
const HEIGHT = 4096;
const mercatorY = (latDeg) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
const MERCATOR_Y_LIMIT = mercatorY(LAT_LIMIT);

function project([lng, lat]) {
  const clampedLat = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, lat));
  const x = ((lng + 180) / 360) * WIDTH;
  const y = ((MERCATOR_Y_LIMIT - mercatorY(clampedLat)) / (2 * MERCATOR_Y_LIMIT)) * HEIGHT;
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

function ringToPathData(ring) {
  return ringToSegments(ring)
    .map((segment) => {
      const points = segment.map(project);
      return `M ${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")} Z`;
    })
    .join(" ");
}

function geometryToPathData(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPathData).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat().map(ringToPathData).join(" ");
  }
  return "";
}

const paths = geojson.features
  .map((f) => geometryToPathData(f.geometry))
  .filter(Boolean)
  .map((d) => `<path d="${d}" />`)
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" />
  <g fill="#c9c9c2" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
    ${paths}
  </g>
</svg>`;

// Rasterize via a headless browser rather than a native canvas/SVG library,
// to avoid adding a native-binary dependency for a one-off build script.
const scratchDir = mkdtempSync(path.join(tmpdir(), "plain-basemap-"));
const htmlPath = path.join(scratchDir, "plain-basemap.html");
writeFileSync(htmlPath, `<!doctype html><html><body style="margin:0;padding:0;">${svg}</body></html>`);

const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.goto(`file://${htmlPath}`);
  const outPath = path.join(__dirname, "../public/plain-basemap.png");
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT}) from ${geojson.features.length} country features`);
} finally {
  await browser.close();
  rmSync(scratchDir, { recursive: true, force: true });
}
