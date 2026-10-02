import { NextRequest, NextResponse } from "next/server";
import { deleteLabNoteImage, updateLabNoteImage } from "@/lib/project-lab-notes-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, imageId } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : undefined;
    if (title !== undefined && !title) {
      return NextResponse.json({ errors: ["A title is required"] }, { status: 400 });
    }
    const notes = typeof body?.notes === "string" ? body.notes : undefined;

    const image = await updateLabNoteImage(imageId, { title, notes });
    return NextResponse.json({ image });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, imageId } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    await deleteLabNoteImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
