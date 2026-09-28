import { NextRequest, NextResponse } from "next/server";
import {
  addMemberByIdentifier,
  listMembers,
  PROJECT_ROLES,
  ProjectRole,
} from "@/lib/project-members-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

// Visible to any member (Viewers included) — see
// AUTH_AND_PERMISSIONS_PLAN.md: "every project member (any role) can see
// who else is on the project." `role` is the caller's own, so the UI can
// decide what to show (the Add member form, role dropdowns) without a
// second request.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const members = await listMembers(id);
    return NextResponse.json({ members, role: roleAuth.role });
  } catch (error) {
    return apiError(error);
  }
}

// Owners only — "Add member" on a project (AUTH_AND_PERMISSIONS_PLAN.md's
// "Inviting people": enter an email or username and pick a role).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "owner");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const role = body?.role as ProjectRole;
    if (!identifier) {
      return NextResponse.json({ errors: ["An email or username is required"] }, { status: 400 });
    }
    if (!PROJECT_ROLES.includes(role)) {
      return NextResponse.json({ errors: [`Unknown role "${body?.role}"`] }, { status: 400 });
    }

    const result = await addMemberByIdentifier(id, identifier, role);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity(
      "project",
      "member_added",
      result.invited
        ? `Invited ${identifier} to this project as ${role}`
        : `Added ${identifier} to this project as ${role}`,
      undefined,
      id
    );
    return NextResponse.json({ member: result.member, invited: result.invited }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
