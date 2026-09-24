import { NextRequest, NextResponse } from "next/server";
import { deleteLabNoteImage } from "@/lib/project-lab-notes-store";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;
    await deleteLabNoteImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
