import { NextResponse } from "next/server";
import { existingIdentifiers } from "@/lib/samples-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Just the Sample IDs already in the caller's own database — used to check
// for duplicates while staging, without pulling every sample's full data.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const identifiers = await existingIdentifiers(auth.user.id);
    return NextResponse.json({ identifiers: [...identifiers] });
  } catch (error) {
    return apiError(error);
  }
}
