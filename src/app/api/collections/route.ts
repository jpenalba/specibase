import { NextRequest, NextResponse } from "next/server";
import { createCollection, listCollections, listCollectionSampleRefs } from "@/lib/collections-store";
import { apiError } from "@/lib/api-error";
import { parseCollectionFields } from "./parse-body";

export async function GET() {
  try {
    const [collections, sampleRefs] = await Promise.all([
      listCollections(),
      listCollectionSampleRefs(),
    ]);
    return NextResponse.json({ collections, sampleRefs });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ errors: ["Collection name is required"] }, { status: 400 });
    }

    const fields = parseCollectionFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    if (fields.date_added !== undefined && !fields.date_added.trim()) {
      return NextResponse.json({ errors: ["Date added is required"] }, { status: 400 });
    }

    const collection = await createCollection({ name, ...fields });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
