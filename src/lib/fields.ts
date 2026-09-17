export type FieldType = "text" | "date" | "number";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
};

// The bare minimum every sample must have. These columns are always
// present in the table and always included in the CSV template.
export const REQUIRED_FIELDS: FieldDef[] = [
  { key: "primary_identifier", label: "Sample ID", type: "text" },
  { key: "species", label: "Species", type: "text" },
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
];

// Everything else is opt-in per lab/project: tick which of these to
// show as table columns and include in the downloadable CSV template.
// Add more entries here as the lab's workflow needs grow — nothing
// else in the app needs to change to pick up a new optional field.
export const OPTIONAL_FIELDS: FieldDef[] = [
  { key: "collection_date", label: "Collection date", type: "date" },
  { key: "country", label: "Country", type: "text" },
  { key: "locality", label: "Locality", type: "text" },
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
  "locality",
  "additional_number",
  "notes",
];

export const ALL_FIELDS: FieldDef[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

export function optionalFieldByKey(key: string): FieldDef | undefined {
  return OPTIONAL_FIELDS.find((f) => f.key === key);
}
