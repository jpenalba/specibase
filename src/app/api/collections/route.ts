import { NextRequest, NextResponse } from "next/server";
import { createCollection, listCollections, listCollectionSampleRefs } from "@/lib/collections-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";
import { parseCollectionFields } from "./parse-body";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const [collections, sampleRefs] = await Promise.all([
      listCollections(auth.user.id),
      listCollectionSampleRefs(auth.user.id),
    ]);
    return NextResponse.json({ collections, sampleRefs });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
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

    const collection = await createCollection({ name, ...fields }, auth.user.id);
    await logActivity("collection", "created", `Created collection "${collection.name}"`);
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
