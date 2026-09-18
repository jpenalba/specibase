export type FieldType = "text" | "date" | "number";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
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
  { key: "collection_date", label: "Collection date", type: "date" },
  { key: "country", label: "Country", type: "text" },
  {
    key: "additional_number",
    label: "Additional number",
    type: "text",
    description: "Museum voucher, field number, or other secondary ID",
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
  "additional_number",
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
