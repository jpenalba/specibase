import { getSupabase } from "./supabase";
import { findProfileByIdentifier, formatDisplayName } from "./profile-store";

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

export type AddMemberResult =
  | { ok: true; member: ProjectMember; invited: boolean }
  | { ok: false; errors: string[] };

// Looks the identifier up as an existing account first (username or
// email); if nothing matches and it looks like an email, sends a Supabase
// Auth invite — the invite itself creates the auth.users row (which the
// handle_new_user trigger mirrors into profiles), so the membership row
// can be created for the new account in the same call. See
// AUTH_AND_PERMISSIONS_PLAN.md's "Inviting people" — one flow, not two.
export async function addMemberByIdentifier(
  projectId: string,
  identifier: string,
  role: ProjectRole,
  siteUrl: string
): Promise<AddMemberResult> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, errors: ["An email or username is required"] };

  const existing = await findProfileByIdentifier(trimmed);
  if (existing) {
    const member = await addMember(projectId, existing.id, role);
    return { ok: true, member, invited: false };
  }

  if (!trimmed.includes("@")) {
    return { ok: false, errors: [`No account found for username "${trimmed}"`] };
  }

  // Without redirectTo, Supabase sends the invite link to whatever Site URL
  // is configured in its own dashboard — easy to leave pointed at
  // localhost, or at nothing, and either way the invited person lands
  // somewhere that was never built to receive them. /reset-password
  // already handles "a Supabase link just dropped me here with a fresh
  // session" generically (see its own comment) — an invite link
  // establishes a session the same way a recovery link does, so reusing it
  // here needs no new page.
  const { data, error } = await getSupabase().auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (error) return { ok: false, errors: [error.message] };
  if (!data.user) return { ok: false, errors: ["Couldn't send the invite"] };

  const member = await addMember(projectId, data.user.id, role);
  return { ok: true, member, invited: true };
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
