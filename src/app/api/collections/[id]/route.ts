import { NextRequest, NextResponse } from "next/server";
import { updateCollection } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";
import { parseCollectionFields } from "../parse-body";

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
        return NextResponse.json({ errors: ["Collection name is required"] }, { status: 400 });
      }
    }

    const fields = parseCollectionFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    if (fields.date_added !== undefined && !fields.date_added.trim()) {
      return NextResponse.json({ errors: ["Date added is required"] }, { status: 400 });
    }

    const collection = await updateCollection(id, { name, ...fields });
    await logActivity("collection", "updated", `Updated collection "${collection.name}"`);
    return NextResponse.json({ collection });
  } catch (error) {
    return apiError(error);
  }
}
