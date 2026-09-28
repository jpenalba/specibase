import { NextRequest, NextResponse } from "next/server";
import { addCustomColumn, getWorkflow, listCustomColumns } from "@/lib/lab-workflows-store";
import { requireUser } from "@/lib/require-user";
import { requireEntityProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getWorkflow(id), "viewer");
    if ("response" in wfAuth) return wfAuth.response;

    const columns = await listCustomColumns(id);
    return NextResponse.json({ columns });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Column label is required"] }, { status: 400 });
    }
    const column = await addCustomColumn(id, label);
    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
