import { NextRequest, NextResponse } from "next/server";
import { deleteCustomColumn, renameCustomColumn } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ columnId: string }> }
) {
  try {
    const { columnId } = await params;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Column label is required"] }, { status: 400 });
    }
    const column = await renameCustomColumn(columnId, label);
    return NextResponse.json({ column });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ columnId: string }> }
) {
  try {
    const { columnId } = await params;
    await deleteCustomColumn(columnId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
