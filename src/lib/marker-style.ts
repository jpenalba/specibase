import { SampleRecord } from "./samples-store";
import { MarkerStyle } from "./project-marker-styles-store";
import { LayerShape, DEFAULT_LAYER_SHAPE } from "./layer-shapes";
import { colorForCategoryIndex } from "./layer-colors";

export type CategoryStyle = {
  // "" stands for "no value" — samples missing the chosen field group here.
  value: string;
  label: string;
  color: string;
  shape: LayerShape;
  count: number;
  // Whether this came from a saved project_marker_styles row, vs. an
  // automatically assigned color the picker can still override.
  isOverridden: boolean;
};

// Every distinct value of `fieldKey` present among `samples`, each with its
// count and resolved color/shape — a saved override if one exists for that
// value, otherwise an automatically assigned color (stable by sorted
// position, so it doesn't reshuffle as unrelated samples are added).
// Shared by the marker style panel (to render swatches/pickers) and the
// Samples page (to build the map's per-sample styling and PDF legend), so
// the two can't disagree on what color a value has.
export function resolveCategoryStyles(
  samples: SampleRecord[],
  fieldKey: string,
  overrides: MarkerStyle[]
): CategoryStyle[] {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const raw = sample[fieldKey];
    const value = raw === undefined || raw === null || String(raw).trim() === "" ? "" : String(raw);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const overrideByValue = new Map(
    overrides.filter((o) => o.field_key === fieldKey).map((o) => [o.field_value, o])
  );

  // "No value" always sorts last — everything else alphabetically, so the
  // automatic color assignment (by this order) stays predictable.
  const values = [...counts.keys()].sort((a, b) => {
    if (a === "" || b === "") return a === b ? 0 : a === "" ? 1 : -1;
    return a.localeCompare(b);
  });

  return values.map((value, index) => {
    const override = overrideByValue.get(value);
    return {
      value,
      label: value === "" ? "(No value)" : value,
      color: override?.color ?? colorForCategoryIndex(index),
      shape: override?.shape ?? DEFAULT_LAYER_SHAPE,
      count: counts.get(value) ?? 0,
      isOverridden: Boolean(override),
    };
  });
}
