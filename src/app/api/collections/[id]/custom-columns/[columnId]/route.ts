import { NextRequest, NextResponse } from "next/server";
import {
  deleteCollectionCustomColumn,
  renameCollectionCustomColumn,
} from "@/lib/collection-custom-columns-store";
import { requireUser } from "@/lib/require-user";
import { requireCollectionRole } from "@/lib/require-collection-role";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, columnId } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Field name is required"] }, { status: 400 });
    }
    const column = await renameCollectionCustomColumn(columnId, label, id);
    return NextResponse.json({ column });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, columnId } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;
    await deleteCollectionCustomColumn(columnId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
