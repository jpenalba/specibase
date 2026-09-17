import { NextRequest, NextResponse } from "next/server";
import { buildTemplateHeaders } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const fieldsParam = request.nextUrl.searchParams.get("fields") ?? "";
  const selectedOptionalKeys = fieldsParam
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const headers = buildTemplateHeaders(selectedOptionalKeys);
  const csv = headers.join(",") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="specibase-sample-template.csv"',
    },
  });
}
