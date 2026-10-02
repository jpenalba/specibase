import { getSupabase } from "./supabase";
import { findProfileByIdentifier, formatDisplayName } from "./profile-store";

const TABLE = "collaborators";

// `id` here is the collaborator's own profile id (not a row id — the
// table's real key is the (user_id, collaborator_id) pair), matching how
// the Members-dialog add/remove calls already address a person by their
// user id.
export type CollaboratorWithProfile = {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

// Everyone `userId` has saved as a collaborator. Two separate queries
// rather than embedding `profiles` in the select below: collaborators has
// two columns referencing profiles (user_id, collaborator_id), which
// PostgREST can't disambiguate in a nested select without relying on a
// specific generated constraint name — same tradeoff
// notifications-store.ts's listUnseenNotifications makes for the same
// reason (see its comment there).
export async function listCollaborators(userId: string): Promise<CollaboratorWithProfile[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("collaborator_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.collaborator_id);
  const { data: profiles, error: profilesError } = await getSupabase()
    .from("profiles")
    .select("id, email, username, title, first_name, last_name, avatar_url")
    .in("id", ids);
  if (profilesError) throw new Error(profilesError.message);
  const profileById = new Map((profiles ?? []).map((p: ProfileRow) => [p.id, p]));

  return rows
    .map((row) => {
      const profile = profileById.get(row.collaborator_id);
      if (!profile) return null;
      return {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        display_name: formatDisplayName(profile),
        avatar_url: profile.avatar_url,
        created_at: row.created_at,
      } as CollaboratorWithProfile;
    })
    .filter((c): c is CollaboratorWithProfile => c !== null);
}

export type AddCollaboratorResult =
  | { ok: true; collaborator: CollaboratorWithProfile; alreadyAdded: boolean }
  | { ok: false; errors: string[] };

// Looks the identifier up as an existing account only — unlike
// addMemberByIdentifier (project/collection sharing), there's no invite
// flow here: a collaborator is just a saved shortcut to someone who
// already has a Specibase account.
export async function addCollaborator(
  userId: string,
  identifier: string
): Promise<AddCollaboratorResult> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, errors: ["An email or username is required"] };

  const profile = await findProfileByIdentifier(trimmed);
  if (!profile) return { ok: false, errors: [`No account found for "${trimmed}"`] };
  if (profile.id === userId) {
    return { ok: false, errors: ["You can't add yourself as a collaborator"] };
  }

  const { data: existing, error: existingError } = await getSupabase()
    .from(TABLE)
    .select("created_at")
    .eq("user_id", userId)
    .eq("collaborator_id", profile.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let createdAt = existing?.created_at as string | undefined;
  if (!existing) {
    const { data: inserted, error } = await getSupabase()
      .from(TABLE)
      .insert({ user_id: userId, collaborator_id: profile.id })
      .select("created_at")
      .single();
    if (error) throw new Error(error.message);
    createdAt = inserted.created_at;
  }

  return {
    ok: true,
    alreadyAdded: !!existing,
    collaborator: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      display_name: formatDisplayName(profile),
      avatar_url: profile.avatar_url,
      created_at: createdAt!,
    },
  };
}

export async function removeCollaborator(userId: string, collaboratorId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("collaborator_id", collaboratorId);
  if (error) throw new Error(error.message);
}
