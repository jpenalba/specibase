import { NextRequest, NextResponse } from "next/server";
import { enrollSamples, unenrollSamples } from "@/lib/lab-workflows-store";
import { apiError } from "@/lib/api-error";
import { parseSampleIds } from "../../parse-body";

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
    await enrollSamples(id, sampleIds);
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
    await unenrollSamples(id, sampleIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
