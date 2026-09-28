import { NextResponse } from "next/server";
import { listAllCollectionSamples } from "@/lib/collections-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Every sample across every collection the caller owns, each still
// carrying its own collection_id — used by the database map to draw one
// layer per collection, in one request rather than one per collection.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const samples = await listAllCollectionSamples(auth.user.id);
    return NextResponse.json({ samples });
  } catch (error) {
    return apiError(error);
  }
}
