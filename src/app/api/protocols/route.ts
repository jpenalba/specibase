import { NextRequest, NextResponse } from "next/server";
import { createProtocol, listProtocols } from "@/lib/protocols-store";
import { apiError } from "@/lib/api-error";
import { parseProtocolFields } from "./parse-body";

export async function GET() {
  try {
    const protocols = await listProtocols();
    return NextResponse.json({ protocols });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ errors: ["Protocol name is required"] }, { status: 400 });
    }

    const fields = parseProtocolFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    if (!fields.protocol_type) {
      return NextResponse.json({ errors: ["Protocol type is required"] }, { status: 400 });
    }
    if (!fields.source_type) {
      return NextResponse.json({ errors: ["Protocol source is required"] }, { status: 400 });
    }
    if (fields.date_added !== undefined && !fields.date_added.trim()) {
      return NextResponse.json({ errors: ["Date added is required"] }, { status: 400 });
    }
    if (fields.source_type === "pdf" && !fields.pdf_url?.trim()) {
      return NextResponse.json({ errors: ["Upload a PDF for this protocol"] }, { status: 400 });
    }

    const protocol = await createProtocol({
      name,
      description: fields.description,
      date_added: fields.date_added,
      protocol_type: fields.protocol_type,
      source_type: fields.source_type,
      pdf_url: fields.pdf_url,
      pdf_filename: fields.pdf_filename,
    });
    return NextResponse.json({ protocol }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
