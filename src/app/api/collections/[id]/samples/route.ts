import { NextRequest, NextResponse } from "next/server";
import { getCollection, listCollectionSamples, insertCollectionSamplesBulk } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireCollectionRole } from "@/lib/require-collection-role";
import { RawRow } from "@/lib/validation";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;
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
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;
    const collection = await getCollection(id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
    const body = await request.json();
    const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
    }
    const result = await insertCollectionSamplesBulk(id, rows);
    if (result.inserted.length > 0) {
      const name = collection.name;
      if (result.inserted.length === 1) {
        await logActivity(
          "collection_sample",
          "created",
          `Added sample ${result.inserted[0].primary_identifier} to collection "${name}"`,
          { kind: "delete_collection_samples", collectionId: id, sampleIds: [result.inserted[0].id] }
        );
      } else {
        await logActivity(
          "collection_sample",
          "created",
          `Imported ${result.inserted.length} samples into collection "${name}"`,
          {
            kind: "delete_collection_samples",
            collectionId: id,
            sampleIds: result.inserted.map((s) => s.id),
          }
        );
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
