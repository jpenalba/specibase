import { NextResponse } from "next/server";
import { listAllCollectionSamples } from "@/lib/collections-store";
import { apiError } from "@/lib/api-error";

// Every sample across every collection, each still carrying its own
// collection_id — used by the database map to draw one layer per
// collection, in one request rather than one per collection.
export async function GET() {
  try {
    const samples = await listAllCollectionSamples();
    return NextResponse.json({ samples });
  } catch (error) {
    return apiError(error);
  }
}
