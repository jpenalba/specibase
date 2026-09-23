import { NextRequest, NextResponse } from "next/server";
import { deleteCollectionSample, getCollection } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sampleId: string }> }
) {
  try {
    const { id, sampleId } = await params;
    const result = await deleteCollectionSample(id, sampleId);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    const collection = await getCollection(id);
    await logActivity(
      "collection_sample",
      "deleted",
      `Removed sample ${result.primaryIdentifier} from collection "${collection?.name ?? "collection"}"`,
      { kind: "restore_collection_sample", collectionId: id, sampleId }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
