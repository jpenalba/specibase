import { NextRequest, NextResponse } from "next/server";
import {
  addLabNotesBlock,
  listLabNotesBlocks,
  reorderLabNotesBlocks,
} from "@/lib/project-lab-notes-store";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blocks = await listLabNotesBlocks(id);
    return NextResponse.json({ blocks });
  } catch (error) {
    return apiError(error);
  }
}

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
    const content = typeof body?.content === "string" ? body.content : "";
    const block = await addLabNotesBlock(id, title, content);
    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

// Reorders the whole block list at once, same convention as
// PATCH /api/projects/[id]/bio-notes-blocks.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const orderedBlockIds = body?.orderedBlockIds;
    if (!Array.isArray(orderedBlockIds) || !orderedBlockIds.every((b) => typeof b === "string")) {
      return NextResponse.json(
        { errors: ["orderedBlockIds must be an array of strings"] },
        { status: 400 }
      );
    }
    await reorderLabNotesBlocks(id, orderedBlockIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
