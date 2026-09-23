import { NextRequest, NextResponse } from "next/server";
import { getActivityEntry, markActivityUndone, logActivity } from "@/lib/activity-log";
import { restoreSample, deleteSample } from "@/lib/samples-store";
import { restoreCollectionSample, deleteCollectionSample } from "@/lib/collections-store";
import { apiError } from "@/lib/api-error";

// Reverses one activity-log entry, dispatched on its undo_data.kind (see
// src/lib/activity-log.ts for the full set). Deleting the rows a bulk
// import created re-uses the same soft-delete as an ordinary delete —
// consistent, and itself undoable again if that turns out to be a mistake.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await getActivityEntry(id);
    if (!entry) {
      return NextResponse.json({ errors: ["Log entry not found"] }, { status: 404 });
    }
    if (entry.undone_at) {
      return NextResponse.json({ errors: ["This was already undone"] }, { status: 400 });
    }
    const data = entry.undo_data;
    if (!data) {
      return NextResponse.json({ errors: ["This action can't be undone"] }, { status: 400 });
    }

    switch (data.kind) {
      case "restore_sample": {
        const result = await restoreSample(data.sampleId);
        if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
        break;
      }
      case "delete_samples": {
        for (const sampleId of data.sampleIds) {
          await deleteSample(sampleId);
        }
        break;
      }
      case "restore_collection_sample": {
        const result = await restoreCollectionSample(data.collectionId, data.sampleId);
        if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
        break;
      }
      case "delete_collection_samples": {
        for (const sampleId of data.sampleIds) {
          await deleteCollectionSample(data.collectionId, sampleId);
        }
        break;
      }
      default:
        return NextResponse.json({ errors: ["This action can't be undone"] }, { status: 400 });
    }

    await markActivityUndone(id);
    await logActivity(entry.entity_type, "undone", `Undid: ${entry.summary}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
