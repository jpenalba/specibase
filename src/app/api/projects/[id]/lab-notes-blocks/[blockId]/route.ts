import { NextRequest, NextResponse } from "next/server";
import { updateLabNotesBlock, UpdateLabNotesBlockInput } from "@/lib/project-lab-notes-store";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const body = await request.json();

    const input: UpdateLabNotesBlockInput = {};
    if ("title" in body) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json({ errors: ["A title is required"] }, { status: 400 });
      }
      input.title = title;
    }
    if ("content" in body) {
      input.content = typeof body.content === "string" ? body.content : "";
    }

    const block = await updateLabNotesBlock(blockId, input);
    return NextResponse.json({ block });
  } catch (error) {
    return apiError(error);
  }
}
