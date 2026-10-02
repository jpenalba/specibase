import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/collections-store";
import {
  addCollectionCustomColumn,
  listCollectionCustomColumns,
} from "@/lib/collection-custom-columns-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const collection = await getCollection(id, auth.user.id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
    const columns = await listCollectionCustomColumns(id);
    return NextResponse.json({ columns });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const collection = await getCollection(id, auth.user.id);
    if (!collection) {
      return NextResponse.json({ errors: ["Collection not found"] }, { status: 404 });
    }
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Field name is required"] }, { status: 400 });
    }
    const column = await addCollectionCustomColumn(id, label);
    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
