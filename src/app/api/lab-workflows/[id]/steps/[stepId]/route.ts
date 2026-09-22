import { NextRequest, NextResponse } from "next/server";
import { deleteStep, renameStep } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Step label is required"] }, { status: 400 });
    }
    const step = await renameStep(stepId, label);
    return NextResponse.json({ step });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    await deleteStep(stepId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
