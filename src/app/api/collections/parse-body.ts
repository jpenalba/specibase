import { COLLECTION_TYPES, CollectionType } from "@/lib/collection-types";

// Distinguishes "this key wasn't in the request at all" (undefined — skip
// it on an update) from "it was sent as an empty string" (still undefined
// after trimming, but createCollection/updateCollection turn that into
// null, clearing the field) — mirrors @/app/api/projects/parse-body.ts.
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

export type ParsedCollectionFields = {
  description?: string;
  date_added?: string;
  focal_group?: string;
  location?: string;
  contacts?: string;
  collection_type?: CollectionType;
};

// Shared between POST (create) and PATCH (update) — pulls the collection
// detail fields out of a request body. collection_type is validated
// (rather than trusted like the free-text fields) since it drives which
// folder a collection lands in on the database map's layer panel.
export function parseCollectionFields(
  body: Record<string, unknown>
): ParsedCollectionFields | { error: string } {
  let collectionType: CollectionType | undefined;
  if ("collection_type" in body) {
    if (typeof body.collection_type === "string" && COLLECTION_TYPES.includes(body.collection_type as CollectionType)) {
      collectionType = body.collection_type as CollectionType;
    } else {
      return { error: `Unknown collection type "${body.collection_type}"` };
    }
  }

  return {
    description: stringField(body, "description"),
    date_added: stringField(body, "date_added"),
    focal_group: stringField(body, "focal_group"),
    location: stringField(body, "location"),
    contacts: stringField(body, "contacts"),
    collection_type: collectionType,
  };
}
