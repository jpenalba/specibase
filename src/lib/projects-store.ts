import { getSupabase } from "./supabase";

const PROJECTS_TABLE = "projects";
const LINK_TABLE = "sample_projects";

export type Project = {
  id: string;
  name: string;
  created_at: string;
};

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

// Creating a project with a name that already exists just returns the
// existing one, rather than erroring — typing an existing project's name
// to add more samples to it is a normal thing to do here, not a conflict.
export async function getOrCreateProject(name: string): Promise<Project> {
  const trimmed = name.trim();
  const { data: existing, error: lookupError } = await getSupabase()
    .from(PROJECTS_TABLE)
    .select("*")
    .eq("name", trimmed)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing) return existing as Project;

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

// Links are upserted (ignore duplicates) since a sample can already be
// tied to the project from an earlier upload.
export async function linkSamplesToProject(
  sampleIds: string[],
  projectId: string
): Promise<void> {
  if (sampleIds.length === 0) return;
  const rows = sampleIds.map((sampleId) => ({
    sample_id: sampleId,
    project_id: projectId,
  }));
  const { error } = await getSupabase()
    .from(LINK_TABLE)
    .upsert(rows, { onConflict: "sample_id,project_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
