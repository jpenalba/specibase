import { NextRequest, NextResponse } from "next/server";
import { appendSteps, reorderSteps } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";
import { parseSteps } from "../../parse-body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const steps = parseSteps(body?.steps);
    if ("error" in steps) {
      return NextResponse.json({ errors: [steps.error] }, { status: 400 });
    }
    const created = await appendSteps(id, steps);
    return NextResponse.json({ steps: created }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

// Reorders the whole step list at once — the step builder always submits
// the complete ordering after a drag, not one move at a time.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const orderedStepIds = body?.orderedStepIds;
    if (!Array.isArray(orderedStepIds) || !orderedStepIds.every((s) => typeof s === "string")) {
      return NextResponse.json(
        { errors: ["orderedStepIds must be an array of strings"] },
        { status: 400 }
      );
    }
    await reorderSteps(id, orderedStepIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
