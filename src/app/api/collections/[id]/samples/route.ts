import { NextRequest, NextResponse } from "next/server";
import { listCollectionSamples, insertCollectionSamplesBulk } from "@/lib/collections-store";
import { RawRow } from "@/lib/validation";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const samples = await listCollectionSamples(id);
    return NextResponse.json({ samples });
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
    const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
    }
    const result = await insertCollectionSamplesBulk(id, rows);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
