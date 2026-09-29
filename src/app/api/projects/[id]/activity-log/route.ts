import { NextRequest, NextResponse } from "next/server";
import { listActivityForProject, isProjectLoggingEnabled, setProjectLoggingEnabled } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

// Visible to any member (Viewers included, same as the rest of a
// project's tabs). `enabled` is this project's own toggle, not an app-wide
// one — see AUTH_AND_PERMISSIONS_PLAN.md phase 4.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const [entries, enabled] = await Promise.all([
      listActivityForProject(id),
      isProjectLoggingEnabled(id),
    ]);
    return NextResponse.json({ entries, enabled });
  } catch (error) {
    return apiError(error);
  }
}

// Owners only — turns this project's own Logs tab on/off. Doesn't affect
// whether an action gets recorded at all (that's each actor's own personal
// toggle), only whether it's tagged into this project's view going
// forward.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "owner");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ errors: ["'enabled' must be a boolean"] }, { status: 400 });
    }
    await setProjectLoggingEnabled(id, body.enabled);
    return NextResponse.json({ enabled: body.enabled });
  } catch (error) {
    return apiError(error);
  }
}
