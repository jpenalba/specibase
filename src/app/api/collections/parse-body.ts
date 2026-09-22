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
};

// Shared between POST (create) and PATCH (update) — pulls the collection
// detail fields out of a request body.
export function parseCollectionFields(body: Record<string, unknown>): ParsedCollectionFields {
  return {
    description: stringField(body, "description"),
    date_added: stringField(body, "date_added"),
    focal_group: stringField(body, "focal_group"),
    location: stringField(body, "location"),
    contacts: stringField(body, "contacts"),
  };
}
