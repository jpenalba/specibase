export type CollectionType = "field" | "museum" | "collaborator" | "other";

export const COLLECTION_TYPES: CollectionType[] = ["field", "museum", "collaborator", "other"];

export const COLLECTION_TYPE_LABELS: Record<CollectionType, string> = {
  field: "Field collection",
  museum: "Museum collection",
  collaborator: "Collaborator collection",
  other: "Other",
};

// Plural headings for the database map's layer panel — "Other" pluralizes
// awkwardly as "Others", so this isn't just COLLECTION_TYPE_LABELS + "s".
export const COLLECTION_TYPE_GROUP_LABELS: Record<CollectionType, string> = {
  field: "Field collections",
  museum: "Museum collections",
  collaborator: "Collaborator collections",
  other: "Other collections",
};
