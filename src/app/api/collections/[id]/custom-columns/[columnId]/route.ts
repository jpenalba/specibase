import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/collections-store";
import {
  deleteCollectionCustomColumn,
  renameCollectionCustomColumn,
} from "@/lib/collection-custom-columns-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, columnId } = await params;
    const collection = await getCollection(id, auth.user.id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
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
    const collection = await getCollection(id, auth.user.id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
    await deleteCollectionCustomColumn(columnId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
