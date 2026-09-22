import { NextRequest, NextResponse } from "next/server";
import { createWorkflow, listAllWorkflows, listWorkflowsByProject } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";
import { parseSteps } from "./parse-body";

// Without ?projectId, returns every workflow (across all projects) — used
// by the Lab Workflow tab's project list to show a workflow count per
// project in one request instead of one per project.
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const workflows = projectId
      ? await listWorkflowsByProject(projectId)
      : await listAllWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = typeof body?.project_id === "string" ? body.project_id : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!projectId || !name) {
      return NextResponse.json(
        { errors: ["project_id and name are required"] },
        { status: 400 }
      );
    }
    const steps = parseSteps(body?.steps);
    if ("error" in steps) {
      return NextResponse.json({ errors: [steps.error] }, { status: 400 });
    }
    const result = await createWorkflow(projectId, name, steps);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
