import { NextRequest, NextResponse } from "next/server";
import {
  createProject,
  getOrCreateProject,
  listProjects,
  listSampleProjectLinks,
} from "@/lib/projects-store";
import { apiError } from "@/lib/api-error";

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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
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
    const project = hasDetails
      ? await createProject({
          name,
          description: optionalString(body.description),
          start_date: optionalString(body.start_date),
          owner: optionalString(body.owner),
          collaborators: optionalString(body.collaborators),
          focal_group: optionalString(body.focal_group),
          focal_region: optionalString(body.focal_region),
        })
      : await getOrCreateProject(name);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
