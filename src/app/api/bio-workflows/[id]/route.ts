import { NextRequest, NextResponse } from "next/server";
import {
  BioWorkflowStatus,
  deleteBioWorkflow,
  getBioWorkflow,
  listBioCustomColumns,
  listBioCustomValuesForWorkflow,
  listBioDetailColumns,
  listBioDetailRows,
  listBioDetailValuesForWorkflow,
  listEnrolledBioSamples,
  listBioEntriesForWorkflow,
  listBioSteps,
  updateBioWorkflow,
} from "@/lib/bio-workflows-store";
import { requireUser } from "@/lib/require-user";
import { requireEntityProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

const STATUSES: BioWorkflowStatus[] = ["in_progress", "completed"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "viewer");
    if ("response" in wfAuth) return wfAuth.response;
    const workflow = wfAuth.entity;

    const [steps, links, entries, customColumns, customValues, detailColumns, detailRows, detailValues] =
      await Promise.all([
        listBioSteps(id),
        listEnrolledBioSamples(id),
        listBioEntriesForWorkflow(id),
        listBioCustomColumns(id),
        listBioCustomValuesForWorkflow(id),
        listBioDetailColumns(id),
        listBioDetailRows(id),
        listBioDetailValuesForWorkflow(id),
      ]);
    return NextResponse.json({
      workflow,
      steps,
      sampleIds: links.map((l) => l.sample_id),
      entries,
      customColumns,
      customValues,
      detailColumns,
      detailRows,
      detailValues,
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
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    const body = await request.json();

    let name: string | undefined;
    if ("name" in body) {
      name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ errors: ["Workflow name is required"] }, { status: 400 });
      }
    }

    let status: BioWorkflowStatus | undefined;
    if ("status" in body) {
      if (typeof body.status === "string" && STATUSES.includes(body.status as BioWorkflowStatus)) {
        status = body.status as BioWorkflowStatus;
      } else {
        return NextResponse.json({ errors: [`Unknown status "${body.status}"`] }, { status: 400 });
      }
    }

    const workflow = await updateBioWorkflow(id, { name, status });
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
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const wfAuth = await requireEntityProjectRole(auth.user.id, () => getBioWorkflow(id), "editor");
    if ("response" in wfAuth) return wfAuth.response;

    await deleteBioWorkflow(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
