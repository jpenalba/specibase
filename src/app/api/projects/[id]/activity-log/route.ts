import { NextResponse } from "next/server";
import { listActivityForProject, isActivityLoggingEnabled } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [entries, enabled] = await Promise.all([
      listActivityForProject(id),
      isActivityLoggingEnabled(),
    ]);
    return NextResponse.json({ entries, enabled });
  } catch (error) {
    return apiError(error);
  }
}
