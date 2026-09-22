import { NextRequest, NextResponse } from "next/server";
import {
  deleteWorkflow,
  getWorkflow,
  listEnrolledSamples,
  listEntriesForWorkflow,
  listSteps,
  updateWorkflow,
  WorkflowStatus,
} from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";

const STATUSES: WorkflowStatus[] = ["in_progress", "completed"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ errors: ["Workflow not found"] }, { status: 404 });
    }
    const [steps, links, entries] = await Promise.all([
      listSteps(id),
      listEnrolledSamples(id),
      listEntriesForWorkflow(id),
    ]);
    return NextResponse.json({
      workflow,
      steps,
      sampleIds: links.map((l) => l.sample_id),
      entries,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    let name: string | undefined;
    if ("name" in body) {
      name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ errors: ["Workflow name is required"] }, { status: 400 });
      }
    }

    let status: WorkflowStatus | undefined;
    if ("status" in body) {
      if (typeof body.status === "string" && STATUSES.includes(body.status as WorkflowStatus)) {
        status = body.status as WorkflowStatus;
      } else {
        return NextResponse.json({ errors: [`Unknown status "${body.status}"`] }, { status: 400 });
      }
    }

    const workflow = await updateWorkflow(id, { name, status });
    return NextResponse.json({ workflow });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteWorkflow(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
