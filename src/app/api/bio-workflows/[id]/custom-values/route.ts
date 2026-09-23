import { NextRequest, NextResponse } from "next/server";
import { BioCustomValueUpsertInput, upsertBioCustomValues } from "@/lib/bio-workflows-store";
import { apiError } from "@/lib/api-error";

function parseValues(body: unknown): BioCustomValueUpsertInput[] | { error: string } {
  if (!Array.isArray(body) || body.length === 0) {
    return { error: "At least one value is required" };
  }
  const values: BioCustomValueUpsertInput[] = [];
  for (const raw of body) {
    if (!raw || typeof raw !== "object") return { error: "Invalid value" };
    const row = raw as Record<string, unknown>;
    if (typeof row.column_id !== "string" || typeof row.sample_id !== "string") {
      return { error: "Every value needs column_id and sample_id" };
    }
    const value = typeof row.value === "string" ? row.value.trim() || null : null;
    values.push({ column_id: row.column_id, sample_id: row.sample_id, value });
  }
  return values;
}

// Bulk upsert, same shape as /api/bio-workflows/[id]/entries — one PATCH
// per edit is enough since custom-column cells are single text fields,
// not a drag-paint surface.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const values = parseValues(body?.values);
    if ("error" in values) {
      return NextResponse.json({ errors: [values.error] }, { status: 400 });
    }
    const result = await upsertBioCustomValues(values);
    return NextResponse.json({ values: result });
  } catch (error) {
    return apiError(error);
  }
}
