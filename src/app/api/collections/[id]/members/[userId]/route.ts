import { NextRequest, NextResponse } from "next/server";
import { COLLECTION_ROLES, CollectionRole, removeMember, updateMemberRole } from "@/lib/collection-members-store";
import { getProfile, formatDisplayName } from "@/lib/profile-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireCollectionRole } from "@/lib/require-collection-role";
import { apiError } from "@/lib/api-error";

async function nameFor(userId: string): Promise<string> {
  const profile = await getProfile(userId);
  if (!profile) return "Someone";
  return formatDisplayName(profile) ?? profile.username ?? profile.email;
}

// Owners only — change another member's role. Refuses to demote the
// collection's last Owner (see collection-members-store.ts's
// guardLastOwner).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id, userId } = await params;
    const roleAuth = await requireCollectionRole(auth.user.id, id, "owner");
    if ("response" in roleAuth) return roleAuth.response;

    const body = await request.json();
    const role = body?.role as CollectionRole;
    if (!COLLECTION_ROLES.includes(role)) {
      return NextResponse.json({ errors: [`Unknown role "${body?.role}"`] }, { status: 400 });
    }

    const result = await updateMemberRole(id, userId, role);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    const name = await nameFor(userId);
    await logActivity("collection", "member_role_changed", `Changed ${name}'s role to ${role}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

// An Owner can remove anyone; anyone can remove themselves ("leave this
// collection") regardless of role. Either way goes through the same
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
      const roleAuth = await requireCollectionRole(auth.user.id, id, "owner");
      if ("response" in roleAuth) return roleAuth.response;
    } else {
      const roleAuth = await requireCollectionRole(auth.user.id, id, "viewer");
      if ("response" in roleAuth) return roleAuth.response;
    }

    const name = await nameFor(userId);
    const result = await removeMember(id, userId);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    await logActivity(
      "collection",
      "member_removed",
      isSelf ? `${name} left this collection` : `Removed ${name} from this collection`
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
