import { NextRequest, NextResponse } from "next/server";
import { insertSamplesBulk } from "@/lib/samples-store";
import { linkSamplesToProject } from "@/lib/projects-store";
import { logActivity } from "@/lib/activity-log";
import { RawRow } from "@/lib/validation";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : [];
  const projectId: string | undefined = body?.projectId || undefined;

  if (rows.length === 0) {
    return NextResponse.json({ errors: ["No rows to import"] }, { status: 400 });
  }

  let result;
  try {
    result = await insertSamplesBulk(rows);
  } catch (error) {
    return apiError(error);
  }

  if (result.inserted.length === 1) {
    const sample = result.inserted[0];
    await logActivity(
      "sample",
      "created",
      `Added sample ${sample.primary_identifier} (${sample.species})`,
      { kind: "delete_samples", sampleIds: [sample.id] }
    );
  } else if (result.inserted.length > 1) {
    await logActivity(
      "sample",
      "created",
      `Imported ${result.inserted.length} samples via CSV`,
      { kind: "delete_samples", sampleIds: result.inserted.map((s) => s.id) }
    );
  }

  let project: { id: string } | null = null;
  if (result.inserted.length > 0 && projectId) {
    try {
      project = { id: projectId };
      await linkSamplesToProject(
        result.inserted.map((s) => s.id),
        project.id
      );
    } catch (error) {
      // The samples themselves are already committed at this point —
      // report that plainly rather than returning an unparseable error
      // and leaving the caller thinking nothing happened.
      const message = error instanceof Error ? error.message : "Unexpected error";
      return NextResponse.json(
        {
          ...result,
          project: null,
          errors: [
            `${result.inserted.length} sample(s) were uploaded, but associating them with a project failed: ${message}`,
          ],
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ...result, project }, { status: 200 });
}
