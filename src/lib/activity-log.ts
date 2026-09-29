import { getSupabase } from "./supabase";
import { getCurrentUser } from "./current-user";

const LOG_TABLE = "activity_log";
const PROJECTS_TABLE = "projects";

// Every kind of undo this app currently knows how to reverse — dispatched
// on in /api/activity-log/[id]/undo. Adding a new undoable action means
// adding a case here and in that route, nowhere else.
export type UndoData =
  | { kind: "restore_sample"; sampleId: string }
  | { kind: "delete_samples"; sampleIds: string[] }
  | { kind: "restore_collection_sample"; collectionId: string; sampleId: string }
  | { kind: "delete_collection_samples"; collectionId: string; sampleIds: string[] };

export type ActivityLogEntry = {
  id: string;
  created_at: string;
  entity_type: string;
  action: string;
  summary: string;
  undo_data: UndoData | null;
  undone_at: string | null;
  project_id: string | null;
  performed_by: string | null;
  user_id: string | null;
};

// Fails open (treated as enabled) if the project row is missing or the
// migration hasn't been run yet — matches the column's own default, and
// means a not-yet-migrated instance behaves the same as a freshly migrated
// one rather than silently untagging every project-scoped entry.
export async function isProjectLoggingEnabled(projectId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .select("log_enabled")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return true;
  return data.log_enabled as boolean;
}

// Owner-only — enforced by the caller (requireProjectRole(..., "owner")),
// not here.
export async function setProjectLoggingEnabled(projectId: string, enabled: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .update({ log_enabled: enabled })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

// Records one line in the activity feed. Never throws — logging is a side
// effect of an action that has already succeeded by the time this is
// called, so a logging failure (or a not-yet-migrated database) must never
// surface as if the action itself failed.
//
// Two independent switches gate this, per AUTH_AND_PERMISSIONS_PLAN.md's
// phase 4:
// - The acting account's own personal toggle (profiles.log_enabled, via
//   getCurrentUser().logEnabled) — off means nothing they do gets recorded
//   at all, anywhere, so this returns early with no insert. There's no
//   caller-supplied user id to fall back on: every call site already runs
//   inside an authenticated request, so whoever's signed in *is* the actor.
// - The target project's own toggle (projects.log_enabled), checked only
//   when `projectId` is given — off doesn't stop the entry from being
//   recorded (it still belongs in the actor's own personal log), it just
//   isn't tagged with that project, so it won't show up on that project's
//   own Logs tab.
//
// undoData is omitted for anything that isn't reversible (most entries — a
// project rename, say) — its presence is what puts an "Undo" button on
// this entry in the Logs page. projectId is omitted for anything that
// isn't clearly scoped to one project (most entries today — a sample edit
// from the shared Database, say).
export async function logActivity(
  entityType: string,
  action: string,
  summary: string,
  undoData?: UndoData,
  projectId?: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.logEnabled) return;

    let taggedProjectId = projectId ?? null;
    if (taggedProjectId && !(await isProjectLoggingEnabled(taggedProjectId))) {
      taggedProjectId = null;
    }

    await getSupabase()
      .from(LOG_TABLE)
      .insert({
        entity_type: entityType,
        action,
        summary,
        undo_data: undoData ?? null,
        project_id: taggedProjectId,
        user_id: user.id,
        performed_by: user.username ?? user.email,
      });
  } catch {
    // Swallow — see above.
  }
}

// An account's own cross-cutting personal log — everything they've done,
// across their private data and every project they touch, regardless of
// any project's own toggle (that only gates the *project's* Logs view, not
// this one). Visible only to that account (see the /api/activity-log
// route).
export async function listActivityForUser(userId: string, limit = 300): Promise<ActivityLogEntry[]> {
  const { data, error } = await getSupabase()
    .from(LOG_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogEntry[];
}

export async function listActivityForProject(
  projectId: string,
  limit = 300
): Promise<ActivityLogEntry[]> {
  const { data, error } = await getSupabase()
    .from(LOG_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogEntry[];
}

export async function getActivityEntry(id: string): Promise<ActivityLogEntry | null> {
  const { data, error } = await getSupabase().from(LOG_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ActivityLogEntry) ?? null;
}

export async function markActivityUndone(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from(LOG_TABLE)
    .update({ undone_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
