import { NextRequest, NextResponse } from "next/server";
import { addLabNoteImage, listLabNoteImages } from "@/lib/project-lab-notes-store";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const images = await listLabNoteImages(id);
    return NextResponse.json({ images });
  } catch (error) {
    return apiError(error);
  }
}

// The file itself is uploaded separately, ahead of this call, via the
// generic /api/projects/[id]/images route — this just records the
// resulting URL plus the image's own metadata (title, optional notes,
// optional linked samples).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ errors: ["A title is required"] }, { status: 400 });
    }
    const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
    if (!imageUrl) {
      return NextResponse.json({ errors: ["An image is required"] }, { status: 400 });
    }
    const notes = typeof body?.notes === "string" ? body.notes : undefined;
    const sampleIds = Array.isArray(body?.sample_ids)
      ? body.sample_ids.filter((v: unknown): v is string => typeof v === "string")
      : undefined;

    const image = await addLabNoteImage(id, { title, notes, sample_ids: sampleIds, image_url: imageUrl });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
