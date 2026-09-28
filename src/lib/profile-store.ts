import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";

const TABLE = "profiles";
const AVATAR_BUCKET = "avatars";
const USERNAME_UNIQUE_VIOLATION = "23505";

// "None" isn't stored — a blank title is simply `title: null`.
export const PROFILE_TITLES = ["Dr.", "Prof", "Ph.D."] as const;
export type ProfileTitle = (typeof PROFILE_TITLES)[number];

// Letters, numbers, underscore, hyphen, dot — enough for a login handle,
// deliberately not email-shaped so the two never get confused (the login
// form itself decides which one it's looking at by checking for "@").
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  title: ProfileTitle | null;
  last_name: string | null;
  first_name: string | null;
  institution: string | null;
  department: string | null;
  position: string | null;
  lab_group: string | null;
  avatar_url: string | null;
};

export type ProfileUpdateInput = {
  username?: string | null;
  title?: ProfileTitle | null;
  last_name?: string | null;
  first_name?: string | null;
  institution?: string | null;
  department?: string | null;
  position?: string | null;
  lab_group?: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export type ProfileUpdateResult = { ok: true; profile: Profile } | { ok: false; errors: string[] };

// Always scoped to the caller's own row — there's no path to this that
// takes a target user id from the client, so there's nothing to check
// ownership against beyond "this is whoever's signed in."
export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<ProfileUpdateResult> {
  const patch: Record<string, string | null> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.last_name !== undefined) patch.last_name = input.last_name?.trim() || null;
  if (input.first_name !== undefined) patch.first_name = input.first_name?.trim() || null;
  if (input.institution !== undefined) patch.institution = input.institution?.trim() || null;
  if (input.department !== undefined) patch.department = input.department?.trim() || null;
  if (input.position !== undefined) patch.position = input.position?.trim() || null;
  if (input.lab_group !== undefined) patch.lab_group = input.lab_group?.trim() || null;
  if (input.username !== undefined) {
    const trimmed = input.username?.trim() || null;
    if (trimmed && !USERNAME_PATTERN.test(trimmed)) {
      return {
        ok: false,
        errors: ["Username can only contain letters, numbers, dots, hyphens, and underscores"],
      };
    }
    patch.username = trimmed;
  }

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) {
    if (error.code === USERNAME_UNIQUE_VIOLATION) {
      return { ok: false, errors: [`Username "${patch.username}" is already taken`] };
    }
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, profile: data as Profile };
}

// Uploads to a public bucket (see supabase/migrations/0034_profile_photo_department_username.sql)
// under a per-account folder, updates the profile row, and returns the new
// profile — mirrors uploadProjectImage's shape. A fresh random filename
// each time rather than reusing one, so a stale browser cache never shows
// an old photo at the same URL; the previous file is simply left orphaned
// in storage, same as every other image upload in this app.
export async function uploadAvatar(userId: string, file: File): Promise<Profile> {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const path = `${userId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await getSupabase()
    .storage.from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ avatar_url: publicUrlData.publicUrl })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

// Case-insensitive — matches the lower(username) unique index.
export async function getEmailForUsername(username: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("email")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.email as string | undefined) ?? null;
}

// "Dr. Jane Smith", "Jane Smith" (no title), or null if neither name is
// set yet — callers fall back to username or email themselves in that case.
export function formatDisplayName(profile: {
  title: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  if (!name) return null;
  return profile.title ? `${profile.title} ${name}` : name;
}
