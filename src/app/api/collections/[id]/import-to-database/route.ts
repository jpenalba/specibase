import { NextRequest, NextResponse } from "next/server";
import { getCollection, listCollectionSamples } from "@/lib/collections-store";
import { sampleToRawRow, insertSamplesBulk } from "@/lib/samples-store";
import { ALL_FIELDS } from "@/lib/fields";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

// Copies every sample currently in this collection into the main
// database as ordinary samples — not linked to any project, and not
// removed from the collection, which keeps its own record of what the
// external collection holds regardless of what's since been copied in.
// Uses the same all-or-nothing-on-duplicate bulk insert as a CSV upload,
// so re-running this after nothing's changed just reports 0 inserted
// rather than creating copies.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const samples = await listCollectionSamples(id);
    if (samples.length === 0) {
      return NextResponse.json({ errors: ["This collection has no samples to add"] }, { status: 400 });
    }
    const rows = samples.map((sample) => sampleToRawRow(sample, ALL_FIELDS));
    const result = await insertSamplesBulk(rows);
    if (result.inserted.length > 0) {
      const collection = await getCollection(id);
      await logActivity(
        "sample",
        "created",
        `Added ${result.inserted.length} sample(s) from collection "${collection?.name ?? "collection"}" to the main database`
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
