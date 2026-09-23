import { RawRow } from "./validation";

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

// Hex-bin aggregation rather than individual points/markers — GBIF groups
// occurrences into hexagonal cells and colors each by how many fall inside
// it, so even a sparse or zoomed-out species reads as visible colored
// cells instead of a scatter of barely-there dots. The tradeoff versus the
// earlier point/marker styles: this shows density by region rather than
// individual occurrence locations.
export type GbifStyleId = "classic.poly" | "purpleYellow.poly" | "green.poly";

export const GBIF_STYLES: { id: GbifStyleId; label: string }[] = [
  { id: "classic.poly", label: "Classic (blue)" },
  { id: "purpleYellow.poly", label: "Purple–yellow" },
  { id: "green.poly", label: "Green" },
];

export const DEFAULT_GBIF_STYLE: GbifStyleId = "classic.poly";

export function isGbifStyle(value: string): value is GbifStyleId {
  return GBIF_STYLES.some((s) => s.id === value);
}

// Fewer hexagons per tile means each one covers more area and renders
// bigger — GBIF's own default is tuned for a denser, more granular grid
// than what a "make it more visible" ask calls for here.
const HEX_PER_TILE = 20;

// {z}/{x}/{y} are MapLibre's own raster-source placeholders — everything
// else here is a literal, fixed query string per species/style.
//
// Requests GBIF's "@2x" (retina) tile variant rather than "@1x" — GBIF
// renders its content proportionally larger in it, not just sharper, so
// pairing it with GBIF_TILE_SIZE (see the map component) as the raster
// source's declared tileSize makes the whole layer noticeably more visible
// instead of the barely-there dots @1x produces. Bump to @4x (and
// GBIF_TILE_SIZE to 1024) for larger still, once this can actually be
// checked against a real GBIF response — see this file's other
// network-access caveat.
export function gbifTileUrl(taxonKey: number, style: string): string {
  return `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@2x.png?srs=EPSG:3857&taxonKey=${taxonKey}&style=${encodeURIComponent(style)}&bin=hex&hexPerTile=${HEX_PER_TILE}`;
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

// The classification fields a matched species can fill in automatically —
// deliberately just the four ranks the app tracks as their own columns
// (see fields.ts), not GBIF's full kingdom/phylum/etc. hierarchy.
export type GbifClassification = {
  usageKey: number;
  scientificName: string;
  canonicalName: string;
  rank?: string;
  genus?: string;
  family?: string;
  order?: string;
  class?: string;
  confidence: number;
  matchType: string;
};

// Resolves a free-typed (or GBIF-suggested) name to GBIF's backbone
// taxonomy in one call — used both for the one-at-a-time species picker
// (once someone picks a suggestion) and for bulk CSV import/backfill,
// where there's a plain string and no prior suggest step. Returns null
// for anything GBIF can't confidently place (matchType "NONE", or no
// usageKey at all) — callers leave the taxonomy columns blank rather than
// guessing, since an unmatched name (an undescribed species, a
// morphospecies code) is an expected, valid case here, not an error.
export async function matchGbifSpecies(name: string): Promise<GbifClassification | null> {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&verbose=false`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GBIF species match failed (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  const usageKey = Number(record.usageKey);
  if (record.matchType === "NONE" || !Number.isFinite(usageKey) || usageKey <= 0) {
    return null;
  }

  const str = (key: string): string | undefined =>
    typeof record[key] === "string" ? (record[key] as string) : undefined;

  return {
    usageKey,
    scientificName: str("scientificName") ?? name,
    canonicalName: str("canonicalName") ?? str("scientificName") ?? name,
    rank: str("rank"),
    genus: str("genus"),
    family: str("family"),
    order: str("order"),
    class: str("class"),
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    matchType: typeof record.matchType === "string" ? record.matchType : "NONE",
  };
}

// Looks up GBIF classification once per distinct species name across a
// whole CSV batch, rather than once per row — a hundred rows of the same
// species costs one GBIF call, not a hundred. A failed lookup for one name
// (network hiccup, GBIF down) just leaves that name unmatched rather than
// failing the rest of the batch.
export async function matchGbifSpeciesBatch(
  names: string[]
): Promise<Map<string, GbifClassification | null>> {
  const distinct = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const entries = await Promise.all(
    distinct.map(async (name) => {
      try {
        return [name, await matchGbifSpecies(name)] as const;
      } catch {
        return [name, null] as const;
      }
    })
  );
  return new Map(entries);
}

// Fills genus/family/taxon_order/taxon_class from a resolved match, but
// only where the row doesn't already carry an explicit value for that
// column — e.g. a CSV that already supplied its own Genus column wins.
export function applyGbifClassificationToRow(
  row: RawRow,
  taxonomyByName: Map<string, GbifClassification | null>
): RawRow {
  const match = taxonomyByName.get(row.species?.trim() ?? "");
  if (!match) return row;
  return {
    ...row,
    genus: row.genus?.trim() || match.genus || row.genus,
    family: row.family?.trim() || match.family || row.family,
    taxon_order: row.taxon_order?.trim() || match.order || row.taxon_order,
    taxon_class: row.taxon_class?.trim() || match.class || row.taxon_class,
  };
}
