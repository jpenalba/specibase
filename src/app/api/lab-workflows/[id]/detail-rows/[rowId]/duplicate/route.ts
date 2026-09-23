import { NextRequest, NextResponse } from "next/server";
import { duplicateDetailRow } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rowId: string }> }
) {
  try {
    const { rowId } = await params;
    const result = await duplicateDetailRow(rowId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
