import { NextRequest, NextResponse } from "next/server";
import { deleteBioNoteImage } from "@/lib/project-bio-notes-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

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

    await deleteBioNoteImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
