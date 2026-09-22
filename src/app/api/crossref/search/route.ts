import { NextRequest, NextResponse } from "next/server";
import { searchCrossref } from "@/lib/crossref";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const title = request.nextUrl.searchParams.get("title")?.trim();
    if (!title) {
      return NextResponse.json({ errors: ["title is required"] }, { status: 400 });
    }
    const results = await searchCrossref(title);
    return NextResponse.json({ results });
  } catch (error) {
    return apiError(error);
  }
}
