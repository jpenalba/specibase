import { getSupabase } from "./supabase";
import { findProfileByIdentifier, formatDisplayName } from "./profile-store";
import { inviteOrResendEmail } from "./account-invites";
import { createProjectSharedNotification } from "./notifications-store";

const TABLE = "project_members";

export type ProjectRole = "viewer" | "editor" | "owner";
export const PROJECT_ROLES: ProjectRole[] = ["viewer", "editor", "owner"];

// Higher ranks can do everything a lower rank can — used both to gate
// routes (requireProjectRole) and to compare two members' roles (e.g. "is
// there still at least one Owner after this change").
const ROLE_RANK: Record<ProjectRole, number> = { viewer: 0, editor: 1, owner: 2 };
export function roleAtLeast(role: ProjectRole, min: ProjectRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
};

// A member row joined with just enough of their profile to show them in
// the Members dialog — never the caller's own full profile-editing shape.
export type ProjectMemberWithProfile = ProjectMember & {
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as ProjectRole | undefined) ?? null;
}

export async function listMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*, profiles(email, username, title, first_name, last_name, avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const profile = row.profiles as {
      email: string;
      username: string | null;
      title: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    };
    return {
      project_id: row.project_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      email: profile.email,
      username: profile.username,
      display_name: formatDisplayName(profile),
      avatar_url: profile.avatar_url,
    } as ProjectMemberWithProfile;
  });
}

// Every member of every project in `projectIds`, in one query — used by
// the /projects list page so each card's Owner/Collaborators display
// doesn't cost its own round trip (see listMembers above for the
// single-project version, used on a project's own pages).
export async function listMembersForProjects(
  projectIds: string[]
): Promise<ProjectMemberWithProfile[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*, profiles(email, username, title, first_name, last_name, avatar_url)")
    .in("project_id", projectIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const profile = row.profiles as {
      email: string;
      username: string | null;
      title: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    };
    return {
      project_id: row.project_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      email: profile.email,
      username: profile.username,
      display_name: formatDisplayName(profile),
      avatar_url: profile.avatar_url,
    } as ProjectMemberWithProfile;
  });
}

async function countOwners(projectId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("role", "owner");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Used on project creation (the creator is always its first Owner) and by
// addMember below — upserts rather than inserts, since re-adding someone
// already on the project just updates their role instead of erroring.
export async function addMember(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<ProjectMember> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: "project_id,user_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectMember;
}

// Wraps addMember with the nav-bar notification for the person being
// added — only when this is an actual new membership (not a role change
// on someone already on the project) and only when they didn't add
// themselves (project creation makes the creator its first Owner via
// addMember directly, never through here, but this guards the same case
// defensively). Best-effort: a notification insert failing shouldn't fail
// the share itself, so it's swallowed rather than surfaced to the caller.
async function addMemberAndNotify(
  projectId: string,
  userId: string,
  role: ProjectRole,
  actorId: string
): Promise<ProjectMember> {
  const wasAlreadyMember = (await getMemberRole(projectId, userId)) !== null;
  const member = await addMember(projectId, userId, role);
  if (!wasAlreadyMember && actorId !== userId) {
    try {
      await createProjectSharedNotification(userId, projectId, actorId);
    } catch {
      // See doc comment — never block the share over this.
    }
  }
  return member;
}

export type AddMemberResult =
  | { ok: true; member: ProjectMember; invited: boolean; resent: boolean }
  | { ok: false; errors: string[] };

// Looks the identifier up as an existing account first (username or
// email); if nothing matches and it looks like an email, sends a Supabase
// Auth invite — the invite itself creates the auth.users row (which the
// handle_new_user trigger mirrors into profiles), so the membership row
// can be created for the new account in the same call. See
// AUTH_AND_PERMISSIONS_PLAN.md's "Inviting people" — one flow, not two.
// `actorId` is whoever's adding them (the authenticated caller) — used
// only to attribute the "X shared a project with you" notification.
export async function addMemberByIdentifier(
  projectId: string,
  identifier: string,
  role: ProjectRole,
  siteUrl: string,
  actorId: string
): Promise<AddMemberResult> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, errors: ["An email or username is required"] };
  const isEmail = trimmed.includes("@");

  const existing = await findProfileByIdentifier(trimmed);
  // A profile row exists from the moment someone's invited (the trigger
  // fires on auth.users insert), not just once they've actually accepted —
  // so finding one by email doesn't by itself mean there's nothing left to
  // do. Only short-circuit to "just add them" once the account is actually
  // registered (registered_at set — see profile-store.ts); a still-pending
  // invite falls through to invite/resend below like a brand-new email
  // would. A username match is never ambiguous this way — only an account
  // that's actually set a password could have set one.
  if (existing && (!isEmail || existing.registered_at)) {
    const member = await addMemberAndNotify(projectId, existing.id, role, actorId);
    return { ok: true, member, invited: false, resent: false };
  }

  if (!isEmail) {
    return { ok: false, errors: [`No account found for username "${trimmed}"`] };
  }

  const result = await inviteOrResendEmail(trimmed, `${siteUrl}/reset-password`);
  if (!result.ok) return { ok: false, errors: result.errors };

  const member = await addMemberAndNotify(projectId, result.userId, role, actorId);
  return { ok: true, member, invited: true, resent: result.resent };
}

export type MemberChangeResult = { ok: true } | { ok: false; errors: string[] };

// Refuses to demote/remove the project's last Owner, so a project can
// never end up with no one able to manage its membership — see
// AUTH_AND_PERMISSIONS_PLAN.md's open question on this, resolved that way.
async function guardLastOwner(projectId: string, userId: string, nextRole: ProjectRole | null): Promise<string | null> {
  const current = await getMemberRole(projectId, userId);
  if (current !== "owner" || nextRole === "owner") return null;
  const owners = await countOwners(projectId);
  if (owners <= 1) {
    return "This project needs at least one Owner — promote someone else first.";
  }
  return null;
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<MemberChangeResult> {
  const guardError = await guardLastOwner(projectId, userId, role);
  if (guardError) return { ok: false, errors: [guardError] };

  const { error } = await getSupabase()
    .from(TABLE)
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}

// Also used for "leave this project" — a member removing themselves is
// the same operation as an Owner removing someone else, just called with
// their own id, and gets the same last-Owner protection either way.
export async function removeMember(projectId: string, userId: string): Promise<MemberChangeResult> {
  const guardError = await guardLastOwner(projectId, userId, null);
  if (guardError) return { ok: false, errors: [guardError] };

  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}
