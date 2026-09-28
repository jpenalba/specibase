import { NextRequest, NextResponse } from "next/server";
import {
  createProject,
  getOrCreateProject,
  listProjectsForUser,
  listSampleProjectLinks,
  listProtocolProjectLinks,
} from "@/lib/projects-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";
import { parseProjectFields } from "./parse-body";

// Every sample/protocol project-link is still returned unfiltered — they're
// small join tables, and callers (the Samples/Protocols tabs) already
// intersect them against the projects this response includes.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const [projects, links, protocolLinks] = await Promise.all([
      listProjectsForUser(auth.user.id),
      listSampleProjectLinks(),
      listProtocolProjectLinks(),
    ]);
    return NextResponse.json({ projects, links, protocolLinks });
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
      const { project, created } = await getOrCreateProject(name, auth.user.id);
      if (created) {
        await logActivity(
          "project",
          "created",
          `Created project "${project.name}"`,
          undefined,
          project.id
        );
      }
      return NextResponse.json({ project }, { status: 201 });
    }

    const fields = parseProjectFields(body);
    if ("error" in fields) {
      return NextResponse.json({ errors: [fields.error] }, { status: 400 });
    }
    const project = await createProject({ name, ...fields }, auth.user.id);
    await logActivity(
      "project",
      "created",
      `Created project "${project.name}"`,
      undefined,
      project.id
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
