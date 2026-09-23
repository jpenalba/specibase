import { NextRequest, NextResponse } from "next/server";
import { updateProject } from "@/lib/projects-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";
import { parseProjectFields } from "../parse-body";

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
        return NextResponse.json({ errors: ["Project name is required"] }, { status: 400 });
      }
    }

    const fields = parseProjectFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    const project = await updateProject(id, { name, ...fields });
    await logActivity("project", "updated", `Updated project "${project.name}"`);
    return NextResponse.json({ project });
  } catch (error) {
    return apiError(error);
  }
}
