import { NextRequest, NextResponse } from "next/server";
import { deleteCollectionSample } from "@/lib/collections-store";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sampleId: string }> }
) {
  try {
    const { id, sampleId } = await params;
    const result = await deleteCollectionSample(id, sampleId);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
