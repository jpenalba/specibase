import { NextRequest, NextResponse } from "next/server";
import { insertSamplesBulk } from "@/lib/samples-store";
import { RawRow } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
  }

  const result = insertSamplesBulk(rows);
  return NextResponse.json(result, { status: 200 });
}
