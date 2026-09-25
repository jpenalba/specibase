import { NextRequest, NextResponse } from "next/server";
import { addCustomColumn, listCustomColumns } from "@/lib/sample-custom-columns-store";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const columns = await listCustomColumns();
    return NextResponse.json({ columns });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Field name is required"] }, { status: 400 });
    }
    const column = await addCustomColumn(label);
    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
