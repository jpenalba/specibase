// GBIF's public occurrence-density tile API — no API key required, and it
// aggregates/renders on GBIF's own servers, so the browser fetches map
// tiles directly from GBIF the same way it already does for the Streets
// and Satellite basemaps (see sample-map.tsx). No occurrence points ever
// pass through this app or get stored anywhere.
//
// This sandbox's network egress blocks gbif.org/api.gbif.org, so none of
// this could be verified against a live response while building — it's
// written against GBIF's documented API shape. Worth a smoke test once
// deployed somewhere with normal internet access.
// Must match the "@Nx" multiplier used in gbifTileUrl() below — a normal
// (non-retina) raster tile is 256px, so requesting @2x content (512px of
// actual image per tile) but still declaring a 256 tileSize would just
// downsample it back to the same on-screen size as @1x, sharper but no
// bigger. Declaring the matching larger tileSize instead makes MapLibre
// render that tile's content — GBIF's points included — at its true,
// larger size on screen.
export const GBIF_TILE_SIZE = 512;

export type GbifStyleId = "classic.point" | "purpleYellow.point" | "orange.marker" | "blue.marker";

export const GBIF_STYLES: { id: GbifStyleId; label: string }[] = [
  { id: "classic.point", label: "Classic (blue)" },
  { id: "purpleYellow.point", label: "Purple–yellow" },
  { id: "orange.marker", label: "Orange markers" },
  { id: "blue.marker", label: "Blue markers" },
];

export const DEFAULT_GBIF_STYLE: GbifStyleId = "classic.point";

export function isGbifStyle(value: string): value is GbifStyleId {
  return GBIF_STYLES.some((s) => s.id === value);
}

// {z}/{x}/{y} are MapLibre's own raster-source placeholders — everything
// else here is a literal, fixed query string per species/style.
//
// Requests GBIF's "@2x" (retina) tile variant rather than "@1x" — GBIF
// renders the points/markers themselves proportionally larger in it, not
// just a sharper image, so pairing it with GBIF_TILE_SIZE (see the map
// component) as the raster source's declared tileSize makes the whole
// layer noticeably more visible instead of the barely-there dots @1x
// produces. Bump to @4x (and GBIF_TILE_SIZE to 1024) for larger still, if
// @2x still isn't enough once this can actually be checked against a real
// GBIF response — see this file's other network-access caveat.
export function gbifTileUrl(taxonKey: number, style: string): string {
  return `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@2x.png?srs=EPSG:3857&taxonKey=${taxonKey}&style=${encodeURIComponent(style)}`;
}

export type GbifSpeciesSuggestion = {
  key: number;
  scientificName: string;
  rank?: string;
  status?: string;
};

// Called from our own API route (not directly from the browser) so a
// malformed GBIF response can't leak straight into client code, and so a
// future rate limit or auth requirement only has one call site to update.
export async function searchGbifSpecies(query: string): Promise<GbifSpeciesSuggestion[]> {
  const url = `https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(query)}&limit=8`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GBIF species search failed (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      key: Number(item.key),
      scientificName:
        typeof item.scientificName === "string"
          ? item.scientificName
          : typeof item.canonicalName === "string"
            ? item.canonicalName
            : "Unknown",
      rank: typeof item.rank === "string" ? item.rank : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
    }))
    .filter((item) => Number.isFinite(item.key) && item.key > 0);
}
