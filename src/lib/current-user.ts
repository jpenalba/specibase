import { getSupabaseServerClient } from "./supabase-server";
import { getProfile, formatDisplayName } from "./profile-store";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
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
    displayName: profile ? formatDisplayName(profile) : null,
  };
}
