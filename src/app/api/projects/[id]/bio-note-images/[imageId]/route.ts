import { NextRequest, NextResponse } from "next/server";
import { deleteBioNoteImage } from "@/lib/project-bio-notes-store";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;
    await deleteBioNoteImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
