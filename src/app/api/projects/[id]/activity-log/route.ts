import { NextResponse } from "next/server";
import { listActivityForProject, isActivityLoggingEnabled } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const [entries, enabled] = await Promise.all([
      listActivityForProject(id),
      isActivityLoggingEnabled(),
    ]);
    return NextResponse.json({ entries, enabled });
  } catch (error) {
    return apiError(error);
  }
}
