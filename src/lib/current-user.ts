import { getSupabaseServerClient } from "./supabase-server";
import { getSupabase } from "./supabase";

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

  const { data: profile } = await getSupabase()
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: (profile?.display_name as string | null) ?? null,
  };
}
