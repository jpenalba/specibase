import { NextRequest, NextResponse } from "next/server";
import {
  createBioWorkflow,
  listBioWorkflowsByProject,
  listBioWorkflowsForUser,
} from "@/lib/bio-workflows-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";
import { parseSteps } from "./parse-body";

// Without ?projectId, returns every workflow across every project the
// caller is a member of — used by a project list to show a workflow
// count per project in one request instead of one per project.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) {
      const roleAuth = await requireProjectRole(auth.user.id, projectId, "viewer");
      if ("response" in roleAuth) return roleAuth.response;
      const workflows = await listBioWorkflowsByProject(projectId);
      return NextResponse.json({ workflows });
    }
    const workflows = await listBioWorkflowsForUser(auth.user.id);
    return NextResponse.json({ workflows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const projectId = typeof body?.project_id === "string" ? body.project_id : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!projectId || !name) {
      return NextResponse.json(
        { errors: ["project_id and name are required"] },
        { status: 400 }
      );
    }
    const roleAuth = await requireProjectRole(auth.user.id, projectId, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    const steps = parseSteps(body?.steps);
    if ("error" in steps) {
      return NextResponse.json({ errors: [steps.error] }, { status: 400 });
    }
    const result = await createBioWorkflow(projectId, name, steps);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
