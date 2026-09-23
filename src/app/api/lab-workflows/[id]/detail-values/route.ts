import { NextRequest, NextResponse } from "next/server";
import { DetailValueUpsertInput, upsertDetailValues } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";

function parseValues(body: unknown): DetailValueUpsertInput[] | { error: string } {
  if (!Array.isArray(body) || body.length === 0) {
    return { error: "At least one value is required" };
  }
  const values: DetailValueUpsertInput[] = [];
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

// Bulk upsert, same shape as /api/lab-workflows/[id]/custom-values.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const values = parseValues(body?.values);
    if ("error" in values) {
      return NextResponse.json({ errors: [values.error] }, { status: 400 });
    }
    const result = await upsertDetailValues(values);
    return NextResponse.json({ values: result });
  } catch (error) {
    return apiError(error);
  }
}
