export type ProtocolType = "field" | "lab" | "bioinformatic" | "other";

export const PROTOCOL_TYPES: ProtocolType[] = ["field", "lab", "bioinformatic", "other"];

export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  field: "Field protocol",
  lab: "Lab protocol",
  bioinformatic: "Bioinformatic protocol",
  other: "Other",
};

// How a protocol's content is provided — an uploaded, ready-made PDF, or
// (eventually) built directly in Specibase. The in-app builder itself
// isn't designed yet, so a "built" protocol just has no content for now.
export type ProtocolSourceType = "pdf" | "built";
