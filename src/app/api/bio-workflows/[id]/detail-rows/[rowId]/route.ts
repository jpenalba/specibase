import { NextRequest, NextResponse } from "next/server";
import { deleteBioDetailRow, getBioWorkflow } from "@/lib/bio-workflows-store";
import { requireUser } from "@/lib/require-user";
import { requireEntityProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, rowId } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    await deleteBioDetailRow(rowId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
