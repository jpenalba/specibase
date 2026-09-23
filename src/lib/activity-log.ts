import { getSupabase } from "./supabase";

const LOG_TABLE = "activity_log";
const SETTINGS_TABLE = "app_settings";

export type ActivityLogEntry = {
  id: string;
  created_at: string;
  entity_type: string;
  action: string;
  summary: string;
};

// Fails open (treated as enabled) if the settings row is missing or the
// migration hasn't been run yet — matches the column's own default, and
// means a not-yet-migrated instance behaves the same as a freshly
// migrated one rather than silently logging nothing.
export async function isActivityLoggingEnabled(): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(SETTINGS_TABLE)
    .select("activity_logging_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return true;
  return data.activity_logging_enabled as boolean;
}

export async function setActivityLoggingEnabled(enabled: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from(SETTINGS_TABLE)
    .update({ activity_logging_enabled: enabled })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

// Records one line in the activity feed. A no-op when logging is turned
// off, and never throws — logging is a side effect of an action that has
// already succeeded by the time this is called, so a logging failure
// (or a not-yet-migrated database) must never surface as if the action
// itself failed.
export async function logActivity(
  entityType: string,
  action: string,
  summary: string
): Promise<void> {
  try {
    if (!(await isActivityLoggingEnabled())) return;
    await getSupabase().from(LOG_TABLE).insert({ entity_type: entityType, action, summary });
  } catch {
    // Swallow — see above.
  }
}

export async function listActivity(limit = 300): Promise<ActivityLogEntry[]> {
  const { data, error } = await getSupabase()
    .from(LOG_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogEntry[];
}
