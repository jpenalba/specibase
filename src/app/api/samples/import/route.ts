import { NextRequest, NextResponse } from "next/server";
import { insertSamplesBulk } from "@/lib/samples-store";
import { getOrCreateProject, linkSamplesToProject } from "@/lib/projects-store";
import { RawRow } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
  const projectId: string | undefined = body?.projectId || undefined;
  const newProjectName: string | undefined = body?.newProjectName?.trim() || undefined;

  if (rows.length === 0) {
    return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
  }

  const result = await insertSamplesBulk(rows);

  let project = null;
  if (result.inserted.length > 0 && (projectId || newProjectName)) {
    project = newProjectName
      ? await getOrCreateProject(newProjectName)
      : { id: projectId! };
    await linkSamplesToProject(
      result.inserted.map((s) => s.id),
      project.id
    );
  }

  return NextResponse.json({ ...result, project }, { status: 200 });
}
