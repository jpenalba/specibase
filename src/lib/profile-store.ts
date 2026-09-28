import { getSupabase } from "./supabase";

const TABLE = "profiles";

// "None" isn't stored — a blank title is simply `title: null`.
export const PROFILE_TITLES = ["Dr.", "Prof", "Ph.D."] as const;
export type ProfileTitle = (typeof PROFILE_TITLES)[number];

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  title: ProfileTitle | null;
  last_name: string | null;
  first_name: string | null;
  institution: string | null;
  position: string | null;
  lab_group: string | null;
};

export type ProfileUpdateInput = {
  title?: ProfileTitle | null;
  last_name?: string | null;
  first_name?: string | null;
  institution?: string | null;
  position?: string | null;
  lab_group?: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

// Always scoped to the caller's own row — there's no path to this that
// takes a target user id from the client, so there's nothing to check
// ownership against beyond "this is whoever's signed in."
export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile> {
  const patch: Record<string, string | null> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.last_name !== undefined) patch.last_name = input.last_name?.trim() || null;
  if (input.first_name !== undefined) patch.first_name = input.first_name?.trim() || null;
  if (input.institution !== undefined) patch.institution = input.institution?.trim() || null;
  if (input.position !== undefined) patch.position = input.position?.trim() || null;
  if (input.lab_group !== undefined) patch.lab_group = input.lab_group?.trim() || null;

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

// "Dr. Jane Smith", "Jane Smith" (no title), or null if neither name is
// set yet — callers fall back to email themselves in that case.
export function formatDisplayName(profile: {
  title: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  if (!name) return null;
  return profile.title ? `${profile.title} ${name}` : name;
}
