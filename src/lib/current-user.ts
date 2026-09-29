import { getSupabaseServerClient } from "./supabase-server";
import { getProfile, formatDisplayName } from "./profile-store";

export type CurrentUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  // The account's own "log my activity" switch — defaults to true (the
  // column's own default) when there's no profile row to read it from, so
  // a not-yet-migrated or profile-less account still gets logged, matching
  // the app's existing behavior. See src/lib/activity-log.ts.
  logEnabled: boolean;
};

// The start of the DAL the auth plan calls for — right now this only
// answers "who's signed in", for the nav bar and proxy.ts. Later phases
// build requireOwnership/requireProjectRole on top of this same call.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfile(user.id);

  return {
    id: user.id,
    email: user.email ?? "",
    username: profile?.username ?? null,
    displayName: profile ? formatDisplayName(profile) : null,
    avatarUrl: profile?.avatar_url ?? null,
    logEnabled: profile?.log_enabled ?? true,
  };
}
