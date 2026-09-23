import { NextRequest, NextResponse } from "next/server";
import { deleteProtocol, updateProtocol } from "@/lib/protocols-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";
import { parseProtocolFields } from "../parse-body";

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
        return NextResponse.json({ errors: ["Protocol name is required"] }, { status: 400 });
      }
    }

    const fields = parseProtocolFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    if (fields.date_added !== undefined && !fields.date_added.trim()) {
      return NextResponse.json({ errors: ["Date added is required"] }, { status: 400 });
    }
    if (fields.source_type === "pdf" && fields.pdf_url !== undefined && !fields.pdf_url.trim()) {
      return NextResponse.json({ errors: ["Upload a PDF for this protocol"] }, { status: 400 });
    }

    const protocol = await updateProtocol(id, { name, ...fields });
    await logActivity("protocol", "updated", `Updated protocol "${protocol.name}"`);
    return NextResponse.json({ protocol });
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
    const name = await deleteProtocol(id);
    await logActivity("protocol", "deleted", `Deleted protocol "${name}"`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
