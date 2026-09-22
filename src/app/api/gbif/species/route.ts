import { NextRequest, NextResponse } from "next/server";
import { searchGbifSpecies } from "@/lib/gbif";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ results: [] });
    }
    const results = await searchGbifSpecies(q);
    return NextResponse.json({ results });
  } catch (error) {
    return apiError(error);
  }
}
