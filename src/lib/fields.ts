export type FieldType = "text" | "date" | "number" | "select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  // Required (and exhaustive — no free-typed values allowed) when type is
  // "select". Each option is both the stored value and its own display
  // label, so CSV import/export and the database stay human-readable
  // without a separate value/label lookup.
  options?: string[];
};

// Always required, always shown, never toggleable.
export const REQUIRED_FIELDS: FieldDef[] = [
  { key: "primary_identifier", label: "Sample ID", type: "text" },
  { key: "species", label: "Species", type: "text" },
];

// Not each individually required, but the group as a whole is: either
// latitude+longitude or locality must be provided (see validateRow).
// Always shown together and never part of the optional-field toggle —
// hiding all three would make it impossible to satisfy that requirement.
export const LOCATION_FIELDS: FieldDef[] = [
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
  { key: "locality", label: "Locality", type: "text" },
];

// Everything else is opt-in per lab/project: tick which of these to
// show as table columns and include in the downloadable CSV template.
// Add more entries here as the lab's workflow needs grow — nothing
// else in the app needs to change to pick up a new optional field.
export const OPTIONAL_FIELDS: FieldDef[] = [
  {
    key: "subspecies",
    label: "Subspecies",
    type: "text",
    description: "Free text — GBIF's infraspecific coverage is patchy, so this is never required to match",
  },
  {
    key: "genus",
    label: "Genus",
    type: "text",
    description: "Auto-filled from GBIF when Species is matched there; editable by hand otherwise",
  },
  { key: "family", label: "Family", type: "text", description: "Auto-filled from GBIF when Species is matched there" },
  {
    key: "taxon_order",
    label: "Order",
    type: "text",
    description: "Auto-filled from GBIF when Species is matched there",
  },
  {
    key: "taxon_class",
    label: "Class",
    type: "text",
    description: "Auto-filled from GBIF when Species is matched there",
  },
  { key: "collection_date", label: "Collection date", type: "date" },
  { key: "country", label: "Country", type: "text" },
  {
    key: "specimen_age",
    label: "Modern/Historical",
    type: "select",
    options: ["Modern", "Historical"],
    description: "Whether this is a fresh field-collected specimen or a historical/museum one",
  },
  { key: "museum_voucher", label: "Museum voucher", type: "text" },
  { key: "field_number", label: "Field number", type: "text" },
  {
    key: "secondary_number",
    label: "Secondary number",
    type: "text",
    description: "Any other identifier that doesn't fit Museum voucher or Field number",
  },
  { key: "collector", label: "Collector", type: "text" },
  { key: "tissue_type", label: "Tissue type", type: "text" },
  { key: "storage_location", label: "Storage location", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

// Pre-ticked when someone first opens the app; still fully editable.
export const DEFAULT_OPTIONAL_KEYS = [
  "collection_date",
  "country",
  "secondary_number",
  "notes",
];

export const ALL_FIELDS: FieldDef[] = [
  ...REQUIRED_FIELDS,
  ...LOCATION_FIELDS,
  ...OPTIONAL_FIELDS,
];

export function optionalFieldByKey(key: string): FieldDef | undefined {
  return OPTIONAL_FIELDS.find((f) => f.key === key);
}

// Fields a project's Samples-tab map can color/shape markers by (see
// marker-style.ts) — every text or select field a sample can have,
// required or optional, except the sample ID itself (unique per sample, so
// grouping by it would just assign every marker its own color). Date/number
// fields aren't included since they don't read as discrete categories.
// Adding a new text/select OPTIONAL_FIELDS entry (a population/subspecies
// column, say) makes it available here automatically.
export const MARKER_STYLE_FIELDS: FieldDef[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].filter(
  (f) => (f.type === "text" || f.type === "select") && f.key !== "primary_identifier"
);

export function markerStyleFieldByKey(key: string): FieldDef | undefined {
  return MARKER_STYLE_FIELDS.find((f) => f.key === key);
}

// The full set of columns currently shown for a table/popup/etc, given
// which optional fields are ticked — used by anywhere that needs to know
// "every field visible right now," not just the table.
export function getVisibleColumns(visibleOptionalKeys: string[]): FieldDef[] {
  return [
    ...REQUIRED_FIELDS,
    ...LOCATION_FIELDS,
    ...visibleOptionalKeys
      .map((key) => optionalFieldByKey(key))
      .filter((f): f is FieldDef => Boolean(f)),
  ];
}
