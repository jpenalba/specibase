import { getSupabase } from "./supabase";
import { formatDisplayName } from "./profile-store";

const TABLE = "notifications";

// See supabase/migrations/0040_notifications.sql and
// 0044_collection_members.sql for why `type` is still a real column rather
// than this being hardcoded.
export type NotificationType = "project_shared" | "collection_shared";

export type Notification = {
  id: string;
  type: NotificationType;
  project_id: string | null;
  project_name: string | null;
  collection_id: string | null;
  collection_name: string | null;
  actor_name: string | null;
  created_at: string;
};

// Fires right after a brand-new project_members row is created for
// someone other than whoever added them — see addMemberAndNotify in
// project-members-store.ts, the only call site. Never thrown on by its
// caller: a missed notification shouldn't fail the share itself.
export async function createProjectSharedNotification(
  userId: string,
  projectId: string,
  actorId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .insert({ user_id: userId, type: "project_shared", project_id: projectId, actor_id: actorId });
  if (error) throw new Error(error.message);
}

// Same shape as createProjectSharedNotification above, fired from
// addMemberAndNotify in collection-members-store.ts.
export async function createCollectionSharedNotification(
  userId: string,
  collectionId: string,
  actorId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .insert({ user_id: userId, type: "collection_shared", collection_id: collectionId, actor_id: actorId });
  if (error) throw new Error(error.message);
}

// The nav bar's bell — everything still unseen for the signed-in caller,
// newest first. project_name/actor_name are resolved here rather than left
// as ids so the bell never needs a second round trip per notification.
export async function listUnseenNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("id, type, created_at, project_id, collection_id, actor_id, projects(name), collections(name)")
    .eq("user_id", userId)
    .is("seen_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // A separate lookup rather than embedding profiles in the select above:
  // notifications has two columns referencing profiles (user_id, actor_id),
  // which PostgREST can't disambiguate in a nested select without relying
  // on a specific generated constraint name — this sidesteps that entirely.
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => !!id))];
  const actorById = new Map<
    string,
    { email: string; username: string | null; title: string | null; first_name: string | null; last_name: string | null }
  >();
  if (actorIds.length > 0) {
    const { data: actors, error: actorsError } = await getSupabase()
      .from("profiles")
      .select("id, email, username, title, first_name, last_name")
      .in("id", actorIds);
    if (actorsError) throw new Error(actorsError.message);
    for (const actor of actors ?? []) actorById.set(actor.id, actor);
  }

  return rows.map((row) => {
    const actor = row.actor_id ? actorById.get(row.actor_id) : undefined;
    const actorName = actor ? (formatDisplayName(actor) ?? actor.username ?? actor.email) : null;
    return {
      id: row.id,
      type: row.type,
      project_id: row.project_id,
      project_name: (row.projects as unknown as { name: string } | null)?.name ?? null,
      collection_id: row.collection_id,
      collection_name: (row.collections as unknown as { name: string } | null)?.name ?? null,
      actor_name: actorName,
      created_at: row.created_at,
    };
  });
}

// Only ever clears the caller's own notification — eq("user_id", userId)
// is the whole access check, same pattern as every other owner-scoped
// mutation in this app (see require-user.ts).
export async function markNotificationSeen(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
