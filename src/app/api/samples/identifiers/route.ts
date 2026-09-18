import { NextResponse } from "next/server";
import { existingIdentifiers } from "@/lib/samples-store";
import { apiError } from "@/lib/api-error";

// Just the Sample IDs already in the database — used to check for
// duplicates while staging, without pulling every sample's full data.
export async function GET() {
  try {
    const identifiers = await existingIdentifiers();
    return NextResponse.json({ identifiers: [...identifiers] });
  } catch (error) {
    return apiError(error);
  }
}
