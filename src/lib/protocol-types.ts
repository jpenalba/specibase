export type ProtocolType = "field" | "lab" | "bioinformatic" | "other";

export const PROTOCOL_TYPES: ProtocolType[] = ["field", "lab", "bioinformatic", "other"];

export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  field: "Field protocol",
  lab: "Lab protocol",
  bioinformatic: "Bioinformatic protocol",
  other: "Other",
};

// How a protocol's content is provided — an uploaded, ready-made PDF, or
// a markdown body written directly in Specibase (see
// src/app/protocols/[id]/page.tsx and the `content` column).
export type ProtocolSourceType = "pdf" | "built";
