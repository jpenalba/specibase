import { NextRequest, NextResponse } from "next/server";
import { removeCollaborator } from "@/lib/collaborators-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Removes `id` from the caller's own saved collaborators. There's no
// ownership check beyond scoping the delete to requireUser's own id —
// same pattern as markNotificationSeen.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    await removeCollaborator(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
