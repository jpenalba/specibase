// Fixed categorical order (never cycled/reassigned per-selection) from the
// validated palette. "Main database" always takes slot 1; projects take
// slots 2+ in the order they're listed. Point layers on a map are an
// all-pairs case (every visible layer can sit next to every other), which
// this palette only clears cleanly for its first three slots — past that,
// simultaneously-visible layers lose some distinctness. Acceptable for a
// handful of projects toggled a couple at a time; revisit if labs commonly
// compare many projects on the map at once.
const CATEGORICAL_HEX = [
  "#2a78d6", // blue — main database
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
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
