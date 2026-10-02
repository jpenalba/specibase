import { NextRequest, NextResponse } from "next/server";
import { addCustomColumn, listCustomColumns } from "@/lib/sample-custom-columns-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
    if (projectId) {
      const roleAuth = await requireProjectRole(auth.user.id, projectId, "viewer");
      if ("response" in roleAuth) return roleAuth.response;
    }
    const columns = await listCustomColumns(auth.user.id, projectId);
    return NextResponse.json({ columns });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: ["Field name is required"] }, { status: 400 });
    }
    const projectId = typeof body?.projectId === "string" ? body.projectId : undefined;
    if (projectId) {
      const roleAuth = await requireProjectRole(auth.user.id, projectId, "editor");
      if ("response" in roleAuth) return roleAuth.response;
    }
    const column = await addCustomColumn(label, auth.user.id, projectId);
    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
