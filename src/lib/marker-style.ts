import { SampleRecord } from "./samples-store";
import { MarkerStyle } from "./project-marker-styles-store";
import { LayerShape } from "./layer-shapes";
import { colorForCategoryIndex, shapeForCategoryIndex } from "./layer-colors";
import { MapLayer } from "./layers";

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
      shape: override?.shape ?? shapeForCategoryIndex(index),
      count: counts.get(value) ?? 0,
      isOverridden: Boolean(override),
    };
  });
}

// Builds a project's Samples-tab map layer — either one flat color/shape
// for every linked sample, or one resolved via resolveCategoryStyles per
// sample when a marker-style field is chosen. Shared by the Samples page
// itself and the whole-project PDF export, which renders the same map in
// a hidden, temporary SampleMap instance and needs to build the identical
// layer to get a matching image and legend.
export function buildProjectMapLayer(
  projectId: string,
  tableSamples: SampleRecord[],
  linkedSampleIds: Set<string>,
  markerStyleField: string | null,
  singleColor: string,
  singleShape: LayerShape,
  markerStyles: MarkerStyle[],
  // When true, samples with no value for markerStyleField are dropped from
  // the map (and its legend) entirely, rather than always shown grouped
  // under "(No value)". Only meaningful once a field is chosen.
  hideNoValue: boolean = false
): MapLayer {
  if (!markerStyleField) {
    return {
      id: projectId,
      label: "This project",
      color: singleColor,
      shape: singleShape,
      sampleIds: linkedSampleIds,
    };
  }

  const categories = resolveCategoryStyles(tableSamples, markerStyleField, markerStyles);
  const styleByValue = new Map(categories.map((c) => [c.value, { color: c.color, shape: c.shape }]));
  const noValueSampleIds = new Set<string>();
  const sampleStyles = new Map(
    tableSamples.map((s) => {
      const raw = s[markerStyleField];
      const value = raw === undefined || raw === null || String(raw).trim() === "" ? "" : String(raw);
      if (value === "") noValueSampleIds.add(s.id);
      return [s.id, styleByValue.get(value) ?? { color: singleColor, shape: singleShape }];
    })
  );

  const sampleIds = hideNoValue
    ? new Set([...linkedSampleIds].filter((id) => !noValueSampleIds.has(id)))
    : linkedSampleIds;

  return {
    id: projectId,
    label: "This project",
    color: singleColor,
    shape: singleShape,
    sampleIds,
    sampleStyles,
    legendEntries: categories
      .filter((c) => !(hideNoValue && c.value === ""))
      .map((c) => ({ label: c.label, color: c.color, shape: c.shape, count: c.count })),
  };
}
