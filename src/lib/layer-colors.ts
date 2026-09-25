import { LayerShape, LAYER_SHAPES } from "./layer-shapes";

// Fixed categorical order (never cycled/reassigned per-selection). The
// first 8 are the validated core palette (`node
// dataviz/scripts/validate_palette.js` — lightness band, chroma floor, and
// CVD/normal-vision separation all clear on their own); "main database"
// always takes slot 1, projects/collections/categories take slot 2+ in
// listed order. The next 7 extend it for labs juggling more simultaneous
// layers — same lightness/chroma/normal-vision checks still pass with
// this ordering. Black/white/grey close it out — achromatic, so the
// palette's own CVD/chroma checks don't apply to them (they're not
// competing with any hue), but every marker also carries a pickable
// *shape* (see layer-shapes.ts) regardless: two layers whose colors read
// close under color-blindness, or share no hue to compare at all, still
// don't collide once shape is different. Point layers on a map are an
// all-pairs case (any two visible layers can sit side by side), which no
// fixed palette clears past a handful of slots — color narrows it down,
// shape disambiguates the rest.
const CATEGORICAL_HEX = [
  "#2a78d6", // blue — main database
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#0d9488", // teal
  "#6366f1", // indigo
  "#db2777", // pink
  "#65a30d", // lime
  "#a21caf", // fuchsia
  "#92400e", // brown
  "#ca8a04", // gold
  "#000000", // black
  "#ffffff", // white
  "#6b7280", // grey
];

export const MAIN_DATABASE_COLOR = CATEGORICAL_HEX[0];

export function colorForProjectIndex(index: number): string {
  // Slot 0 is reserved for "main database" — projects start at slot 1 and
  // wrap around (with reduced distinctness) past the palette's length.
  return CATEGORICAL_HEX[(index % (CATEGORICAL_HEX.length - 1)) + 1];
}

// The same palette, offered as manual picks for a layer's map color —
// deliberately the same basic set used for the automatic assignment above,
// not a separate wider picker.
export const PICKABLE_LAYER_COLORS = CATEGORICAL_HEX;

// Auto-assigns a color to the Nth distinct value of a project's chosen
// marker-style field (species, country, ...) that hasn't been manually
// picked — unlike colorForProjectIndex, there's no reserved "main database"
// slot 0 here, since every value is on equal footing.
export function colorForCategoryIndex(index: number): string {
  return CATEGORICAL_HEX[index % CATEGORICAL_HEX.length];
}

// Once every color in the palette is used, a category doesn't just repeat
// a color silently — it moves on to the next shape too (see
// resolveCategoryStyles), so a marker-style field with more distinct
// values than colors still reads as visually distinct (color, shape)
// pairs. Combinations only start repeating past palette-length ×
// shape-count categories (18 × 7 = 126 here).
export function shapeForCategoryIndex(index: number): LayerShape {
  const shapeIndex = Math.floor(index / CATEGORICAL_HEX.length) % LAYER_SHAPES.length;
  return LAYER_SHAPES[shapeIndex];
}

// Shared by anything drawing a legend swatch on an HTML5 canvas or into a
// jsPDF page, both of which want [r,g,b] rather than a hex string.
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
    : [0, 0, 0];
}

// A marker's outline needs to read against its own fill, not just the
// basemap underneath — a fixed white ring (this app's old default) makes a
// white or pale-yellow marker vanish into its own border. Picks whichever
// of black/white gives more contrast against the fill's perceived
// brightness, so every color in the palette — including white and light
// grey — stays visible with a ring around it.
export function strokeColorFor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}
