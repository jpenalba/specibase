import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";

const BUCKET = "project-images";

// Uploads to a public bucket (see supabase/migrations/0008_project_background.sql)
// under a per-project folder, and returns the resulting public URL — the
// only thing the Background editor needs to drop into the markdown as
// `![](url)`. Filenames are randomized rather than reusing the original
// name, since two uploads in the same project could otherwise collide.
export async function uploadProjectImage(projectId: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const path = `${projectId}/${randomUUID()}.${ext}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
