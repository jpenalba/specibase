// Fixed categorical order (never cycled/reassigned per-selection). The
// first 8 are the validated core palette (`node
// dataviz/scripts/validate_palette.js` — lightness band, chroma floor, and
// CVD/normal-vision separation all clear on their own); "main database"
// always takes slot 1, projects/collections/categories take slot 2+ in
// listed order. The next 8 extend it for labs juggling more simultaneous
// layers — same lightness/chroma/normal-vision checks still pass with
// this ordering, with one adjacent pair (gold/coral) in the CVD floor
// band rather than clearing the target, which is why every marker also
// carries a pickable *shape* (see layer-shapes.ts): two layers whose
// colors read close under color-blindness still don't collide once shape
// is different. Point layers on a map are an all-pairs case (any two
// visible layers can sit side by side), which no fixed palette clears
// past a handful of slots — color narrows it down, shape disambiguates
// the rest.
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
  "#f43f5e", // coral
  "#ca8a04", // gold
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

// Shared by anything drawing a legend swatch on an HTML5 canvas or into a
// jsPDF page, both of which want [r,g,b] rather than a hex string.
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
    : [0, 0, 0];
}
