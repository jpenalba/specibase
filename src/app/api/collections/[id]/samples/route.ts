import { NextRequest, NextResponse } from "next/server";
import { getCollection, listCollectionSamples, insertCollectionSamplesBulk } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { RawRow } from "@/lib/validation";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const samples = await listCollectionSamples(id);
    return NextResponse.json({ samples });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
    }
    const result = await insertCollectionSamplesBulk(id, rows);
    if (result.inserted.length > 0) {
      const collection = await getCollection(id);
      const name = collection?.name ?? "collection";
      if (result.inserted.length === 1) {
        await logActivity(
          "collection_sample",
          "created",
          `Added sample ${result.inserted[0].primary_identifier} to collection "${name}"`
        );
      } else {
        await logActivity(
          "collection_sample",
          "created",
          `Imported ${result.inserted.length} samples into collection "${name}"`
        );
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
