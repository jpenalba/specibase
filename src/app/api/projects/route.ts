import { NextRequest, NextResponse } from "next/server";
import {
  createProject,
  getOrCreateProject,
  listProjects,
  listSampleProjectLinks,
} from "@/lib/projects-store";
import { logActivity } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";
import { parseProjectFields } from "./parse-body";

export async function GET() {
  try {
    const [projects, links] = await Promise.all([
      listProjects(),
      listSampleProjectLinks(),
    ]);
    return NextResponse.json({ projects, links });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ errors: ["Project name is required"] }, { status: 400 });
    }

    // The samples page's "associate with a project" picker only ever sends
    // { name } — that flow reuses an existing project by name rather than
    // erroring (see getOrCreateProject). Anything sending more than that is
    // the dedicated /projects page deliberately creating a full profile, so
    // a taken name there should fail loudly rather than silently handing
    // back a different project and dropping every field just typed in.
    const hasDetails = Object.keys(body).some((key) => key !== "name");
    if (!hasDetails) {
      const { project, created } = await getOrCreateProject(name);
      if (created) {
        await logActivity("project", "created", `Created project "${project.name}"`);
      }
      return NextResponse.json({ project }, { status: 201 });
    }

    const fields = parseProjectFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    const project = await createProject({ name, ...fields });
    await logActivity("project", "created", `Created project "${project.name}"`);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
