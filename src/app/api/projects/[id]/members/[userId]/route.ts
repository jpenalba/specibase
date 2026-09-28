import { NextRequest, NextResponse } from "next/server";
import { PROJECT_ROLES, ProjectRole, removeMember, updateMemberRole } from "@/lib/project-members-store";
import { getProfile, formatDisplayName } from "@/lib/profile-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

async function nameFor(userId: string): Promise<string> {
  const profile = await getProfile(userId);
  if (!profile) return "Someone";
  return formatDisplayName(profile) ?? profile.username ?? profile.email;
}

// Owners only — change another member's role. Refuses to demote the
// project's last Owner (see project-members-store.ts's guardLastOwner).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, userId } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "owner");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    const role = body?.role as ProjectRole;
    if (!PROJECT_ROLES.includes(role)) {
      return NextResponse.json({ errors: [`Unknown role "${body?.role}"`] }, { status: 400 });
    }

    const result = await updateMemberRole(id, userId, role);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    const name = await nameFor(userId);
    await logActivity("project", "member_role_changed", `Changed ${name}'s role to ${role}`, undefined, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

// An Owner can remove anyone; anyone can remove themselves ("leave this
// project") regardless of role. Either way goes through the same
// last-Owner guard in removeMember.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, userId } = await params;

    const isSelf = userId === auth.user.id;
    if (!isSelf) {
      const roleAuth = await requireProjectRole(auth.user.id, id, "owner");
      if ("response" in roleAuth) return roleAuth.response;
    } else {
      const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
      if ("response" in roleAuth) return roleAuth.response;
    }

    const name = await nameFor(userId);
    const result = await removeMember(id, userId);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity(
      "project",
      "member_removed",
      isSelf ? `${name} left this project` : `Removed ${name} from this project`,
      undefined,
      id
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
