import { NextRequest, NextResponse } from "next/server";
import { deleteReference, updateReference } from "@/lib/project-references-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, refId } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

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
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, refId } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    await deleteReference(refId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
