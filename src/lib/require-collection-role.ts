import { NextResponse } from "next/server";
import { getMemberRole, CollectionRole, roleAtLeast } from "./collection-members-store";

// The collection-scoped counterpart to require-project-role.ts's
// requireProjectRole — every route that reads or writes data scoped to one
// collection (the collection itself, its samples, custom columns) calls
// this after requireUser, with whatever role that action needs at
// minimum. No requireEntityCollectionRole variant: unlike a project's
// workflows/notes/references, nothing under a collection is keyed by its
// own id carrying collection_id one level down — every collection-scoped
// route is already keyed directly by the collection's own id.
export async function requireCollectionRole(
  userId: string,
  collectionId: string,
  minRole: CollectionRole
): Promise<{ role: CollectionRole } | { response: NextResponse }> {
  const role = await getMemberRole(collectionId, userId);
  if (!role || !roleAtLeast(role, minRole)) {
    return {
      response: NextResponse.json({ errors: ["Not authorized for this collection"] }, { status: 403 }),
    };
  }
  return { role };
}
