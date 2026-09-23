export type DetailColumnKind = "text" | "date";

export type DetailColumnPreset = { label: string; kind: DetailColumnKind };

// Offered when adding a column to a workflow's Detailed view (see
// ManageDetailColumnsDialog). "Date" is the only preset with a non-text
// kind — it renders as a date input rather than a plain text field.
export const DETAIL_COLUMN_PRESETS: DetailColumnPreset[] = [
  { label: "Tissue type", kind: "text" },
  { label: "Method", kind: "text" },
  { label: "Concentration (ng/ul)", kind: "text" },
  { label: "Volume", kind: "text" },
  { label: "Date", kind: "date" },
  { label: "Performed by", kind: "text" },
  { label: "Plate name", kind: "text" },
  { label: "Well", kind: "text" },
  { label: "P7 barcode", kind: "text" },
  { label: "P5 barcode", kind: "text" },
  { label: "Notes", kind: "text" },
];
