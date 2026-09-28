import { NextRequest, NextResponse } from "next/server";
import { deleteBioStep, getBioWorkflow, renameBioStep } from "@/lib/bio-workflows-store";
import { requireUser } from "@/lib/require-user";
import { requireEntityProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, stepId } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Step label is required"] }, { status: 400 });
    }
    const step = await renameBioStep(stepId, label);
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
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, stepId } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    await deleteBioStep(stepId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
