import { NextRequest, NextResponse } from "next/server";
import { duplicateBioDetailRow } from "@/lib/bio-workflows-store";
import { apiError } from "@/lib/api-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rowId: string }> }
) {
  try {
    const { rowId } = await params;
    const result = await duplicateBioDetailRow(rowId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
