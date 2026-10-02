import { getSupabase } from "./supabase";
import { findProfileByIdentifier, formatDisplayName } from "./profile-store";
import { inviteOrResendEmail } from "./account-invites";
import { createCollectionSharedNotification } from "./notifications-store";

const TABLE = "collection_members";

// Mirrors project-members-store.ts's ProjectRole/PROJECT_ROLES exactly —
// see that module for the full reasoning. Kept as its own copy rather than
// shared, the same way every other collection/project pairing in this app
// (custom columns, etc.) duplicates rather than parametrizes.
export type CollectionRole = "viewer" | "editor" | "owner";
export const COLLECTION_ROLES: CollectionRole[] = ["viewer", "editor", "owner"];

const ROLE_RANK: Record<CollectionRole, number> = { viewer: 0, editor: 1, owner: 2 };
export function roleAtLeast(role: CollectionRole, min: CollectionRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type CollectionMember = {
  collection_id: string;
  user_id: string;
  role: CollectionRole;
  created_at: string;
};

// A member row joined with just enough of their profile to show them in
// the Members dialog — never the caller's own full profile-editing shape.
export type CollectionMemberWithProfile = CollectionMember & {
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getMemberRole(collectionId: string, userId: string): Promise<CollectionRole | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("role")
    .eq("collection_id", collectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as CollectionRole | undefined) ?? null;
}

function toMemberWithProfile(row: {
  collection_id: string;
  user_id: string;
  role: CollectionRole;
  created_at: string;
  profiles: unknown;
}): CollectionMemberWithProfile {
  const profile = row.profiles as {
    email: string;
    username: string | null;
    title: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  return {
    collection_id: row.collection_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    email: profile.email,
    username: profile.username,
    display_name: formatDisplayName(profile),
    avatar_url: profile.avatar_url,
  };
}

export async function listMembers(collectionId: string): Promise<CollectionMemberWithProfile[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*, profiles(email, username, title, first_name, last_name, avatar_url)")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMemberWithProfile);
}

// Every member of every collection in `collectionIds`, in one query — the
// collections-equivalent of listMembersForProjects, for a list page that
// shouldn't cost a round trip per card. Not called from anywhere yet (the
// Collections list page doesn't show an Owner/Collaborators row the way
// ProjectCard does), but kept symmetrical with the project store in case
// that changes.
export async function listMembersForCollections(
  collectionIds: string[]
): Promise<CollectionMemberWithProfile[]> {
  if (collectionIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*, profiles(email, username, title, first_name, last_name, avatar_url)")
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMemberWithProfile);
}

async function countOwners(collectionId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId)
    .eq("role", "owner");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Used on collection creation (the creator is always its first Owner) and
// by addMember below — upserts rather than inserts, since re-adding
// someone already on the collection just updates their role instead of
// erroring.
export async function addMember(
  collectionId: string,
  userId: string,
  role: CollectionRole
): Promise<CollectionMember> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .upsert({ collection_id: collectionId, user_id: userId, role }, { onConflict: "collection_id,user_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CollectionMember;
}

// Wraps addMember with the nav-bar notification for the person being
// added — only when this is an actual new membership (not a role change
// on someone already on the collection) and only when they didn't add
// themselves. Best-effort: a notification insert failing shouldn't fail
// the share itself, so it's swallowed rather than surfaced to the caller.
async function addMemberAndNotify(
  collectionId: string,
  userId: string,
  role: CollectionRole,
  actorId: string
): Promise<CollectionMember> {
  const wasAlreadyMember = (await getMemberRole(collectionId, userId)) !== null;
  const member = await addMember(collectionId, userId, role);
  if (!wasAlreadyMember && actorId !== userId) {
    try {
      await createCollectionSharedNotification(userId, collectionId, actorId);
    } catch {
      // See doc comment — never block the share over this.
    }
  }
  return member;
}

export type AddMemberResult =
  | { ok: true; member: CollectionMember; invited: boolean; resent: boolean }
  | { ok: false; errors: string[] };

// Looks the identifier up as an existing account first (username or
// email); if nothing matches and it looks like an email, sends a Supabase
// Auth invite — same flow as addMemberByIdentifier in
// project-members-store.ts, just targeting collection_members instead.
// `actorId` is whoever's adding them — used only to attribute the "X
// shared a collection with you" notification.
export async function addMemberByIdentifier(
  collectionId: string,
  identifier: string,
  role: CollectionRole,
  siteUrl: string,
  actorId: string
): Promise<AddMemberResult> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, errors: ["An email or username is required"] };
  const isEmail = trimmed.includes("@");

  const existing = await findProfileByIdentifier(trimmed);
  // See addMemberByIdentifier in project-members-store.ts for why
  // registered_at (not just a matching profile row) is the real signal
  // that there's nothing left to invite.
  if (existing && (!isEmail || existing.registered_at)) {
    const member = await addMemberAndNotify(collectionId, existing.id, role, actorId);
    return { ok: true, member, invited: false, resent: false };
  }

  if (!isEmail) {
    return { ok: false, errors: [`No account found for username "${trimmed}"`] };
  }

  const result = await inviteOrResendEmail(trimmed, `${siteUrl}/reset-password`);
  if (!result.ok) return { ok: false, errors: result.errors };

  const member = await addMemberAndNotify(collectionId, result.userId, role, actorId);
  return { ok: true, member, invited: true, resent: result.resent };
}

export type MemberChangeResult = { ok: true } | { ok: false; errors: string[] };

// Refuses to demote/remove the collection's last Owner, so it can never
// end up with no one able to manage its membership — same guard as
// project-members-store.ts's guardLastOwner.
async function guardLastOwner(
  collectionId: string,
  userId: string,
  nextRole: CollectionRole | null
): Promise<string | null> {
  const current = await getMemberRole(collectionId, userId);
  if (current !== "owner" || nextRole === "owner") return null;
  const owners = await countOwners(collectionId);
  if (owners <= 1) {
    return "This collection needs at least one Owner — promote someone else first.";
  }
  return null;
}

export async function updateMemberRole(
  collectionId: string,
  userId: string,
  role: CollectionRole
): Promise<MemberChangeResult> {
  const guardError = await guardLastOwner(collectionId, userId, role);
  if (guardError) return { ok: false, errors: [guardError] };

  const { error } = await getSupabase()
    .from(TABLE)
    .update({ role })
    .eq("collection_id", collectionId)
    .eq("user_id", userId);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}

// Also used for "leave this collection" — a member removing themselves is
// the same operation as an Owner removing someone else, just called with
// their own id, and gets the same last-Owner protection either way.
export async function removeMember(collectionId: string, userId: string): Promise<MemberChangeResult> {
  const guardError = await guardLastOwner(collectionId, userId, null);
  if (guardError) return { ok: false, errors: [guardError] };

  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", userId);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}
