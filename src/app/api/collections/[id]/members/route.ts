import { NextRequest, NextResponse } from "next/server";
import {
  addMemberByIdentifier,
  listMembers,
  COLLECTION_ROLES,
  CollectionRole,
} from "@/lib/collection-members-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireCollectionRole } from "@/lib/require-collection-role";
import { apiError } from "@/lib/api-error";

// Visible to any member (Viewers included) — mirrors
// /api/projects/[id]/members's own GET. `role` is the caller's own, so the
// UI can decide what to show (the Add member form, role dropdowns)
// without a second request.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const members = await listMembers(id);
    return NextResponse.json({ members, role: roleAuth.role });
  } catch (error) {
    return apiError(error);
  }
}

// Owners only — "Add member" on a collection, same identifier-or-invite
// flow as a project's own Add member form.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "owner");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const role = body?.role as CollectionRole;
    if (!identifier) {
      return NextResponse.json({ errors: ["An email or username is required"] }, { status: 400 });
    }
    if (!COLLECTION_ROLES.includes(role)) {
      return NextResponse.json({ errors: [`Unknown role "${body?.role}"`] }, { status: 400 });
    }

    const result = await addMemberByIdentifier(
      id,
      identifier,
      role,
      new URL(request.url).origin,
      auth.user.id
    );
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity(
      "collection",
      "member_added",
      result.resent
        ? `Re-invited ${identifier} to this collection as ${role}`
        : result.invited
          ? `Invited ${identifier} to this collection as ${role}`
          : `Added ${identifier} to this collection as ${role}`
    );
    return NextResponse.json(
      { member: result.member, invited: result.invited, resent: result.resent },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
