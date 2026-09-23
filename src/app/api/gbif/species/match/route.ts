import { NextRequest, NextResponse } from "next/server";
import { matchGbifSpecies } from "@/lib/gbif";
import { apiError } from "@/lib/api-error";

// Resolves one name to GBIF's backbone classification (genus/family/order/
// class) — used by the species picker once a suggestion's picked, and
// reusable for anything else that just has a plain name string.
export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ match: null });
    }
    const match = await matchGbifSpecies(name);
    return NextResponse.json({ match });
  } catch (error) {
    return apiError(error);
  }
}
