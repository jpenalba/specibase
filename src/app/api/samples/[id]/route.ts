import { NextRequest, NextResponse } from "next/server";
import { updateSample, deleteSample } from "@/lib/samples-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await request.json();
    const result = await updateSample(id, row);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity("sample", "updated", `Updated sample ${result.sample.primary_identifier}`);
    return NextResponse.json({ sample: result.sample });
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
    const result = await deleteSample(id);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity("sample", "deleted", `Deleted sample ${result.primaryIdentifier}`, {
      kind: "restore_sample",
      sampleId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
