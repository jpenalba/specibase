import { NextRequest, NextResponse } from "next/server";
import { deleteReference, updateReference } from "@/lib/project-references-store";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ refId: string }> }
) {
  try {
    const { refId } = await params;
    const body = await request.json();
    const citation = typeof body?.citation === "string" ? body.citation.trim() : "";
    if (!citation) {
      return NextResponse.json({ errors: ["citation is required"] }, { status: 400 });
    }
    const reference = await updateReference(refId, citation);
    return NextResponse.json({ reference });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ refId: string }> }
) {
  try {
    const { refId } = await params;
    await deleteReference(refId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
