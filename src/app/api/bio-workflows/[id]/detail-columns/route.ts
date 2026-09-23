import { NextRequest, NextResponse } from "next/server";
import { addBioDetailColumn, listBioDetailColumns } from "@/lib/bio-workflows-store";
import { apiError } from "@/lib/api-error";

const ADDABLE_KINDS = ["text", "date"] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const columns = await listBioDetailColumns(id);
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
    const { id } = await params;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Column label is required"] }, { status: 400 });
    }
    const kind = body?.kind;
    if (!ADDABLE_KINDS.includes(kind)) {
      return NextResponse.json({ errors: [`Unknown column kind "${kind}"`] }, { status: 400 });
    }
    const column = await addBioDetailColumn(id, label, kind);
    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
