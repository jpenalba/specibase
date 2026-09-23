import { NextRequest, NextResponse } from "next/server";
import { deleteBioDetailRow } from "@/lib/bio-workflows-store";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ rowId: string }> }
) {
  try {
    const { rowId } = await params;
    await deleteBioDetailRow(rowId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
