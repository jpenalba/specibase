import { NextRequest, NextResponse } from "next/server";
import { deleteGbifSpeciesLayer } from "@/lib/gbif-store";
import { apiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteGbifSpeciesLayer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
