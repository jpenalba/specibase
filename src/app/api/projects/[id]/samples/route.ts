import { NextRequest, NextResponse } from "next/server";
import { linkSamplesToProject, unlinkSamplesFromProject } from "@/lib/projects-store";
import { apiError } from "@/lib/api-error";

function parseSampleIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !("sampleIds" in body)) return null;
  const ids = (body as { sampleIds: unknown }).sampleIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
  return ids;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sampleIds = parseSampleIds(await request.json());
    if (!sampleIds) {
      return NextResponse.json({ errors: ["sampleIds must be an array of strings"] }, { status: 400 });
    }
    await linkSamplesToProject(sampleIds, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sampleIds = parseSampleIds(await request.json());
    if (!sampleIds) {
      return NextResponse.json({ errors: ["sampleIds must be an array of strings"] }, { status: 400 });
    }
    await unlinkSamplesFromProject(sampleIds, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
