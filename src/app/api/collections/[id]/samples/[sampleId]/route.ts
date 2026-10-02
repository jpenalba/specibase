import { NextRequest, NextResponse } from "next/server";
import { deleteCollectionSample, getCollection } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireCollectionRole } from "@/lib/require-collection-role";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sampleId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, sampleId } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;
    const collection = await getCollection(id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
    const result = await deleteCollectionSample(id, sampleId);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity(
      "collection_sample",
      "deleted",
      `Removed sample ${result.primaryIdentifier} from collection "${collection.name}"`,
      { kind: "restore_collection_sample", collectionId: id, sampleId }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
