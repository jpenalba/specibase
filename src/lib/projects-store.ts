import { getSupabase } from "./supabase";

const PROJECTS_TABLE = "projects";
const LINK_TABLE = "sample_projects";

export type Project = {
  id: string;
  name: string;
  created_at: string;
  description: string | null;
  start_date: string | null;
  owner: string | null;
  // Free-text, comma-separated — see parseCollaborators() in
  // @/lib/collaborators for turning this into a list for display.
  collaborators: string | null;
  focal_group: string | null;
  focal_region: string | null;
};

export type NewProjectInput = {
  name: string;
  description?: string;
  start_date?: string;
  owner?: string;
  collaborators?: string;
  focal_group?: string;
  focal_region?: string;
};

// Postgres's unique_violation code — used to turn a duplicate project name
// into a message worth showing someone, instead of a raw constraint error.
const UNIQUE_VIOLATION = "23505";

// Unlike getOrCreateProject() below, this always inserts a new row and
// fails if the name is taken — right for the dedicated projects page,
// where someone is deliberately filling out a full project profile and
// silently handing back a different, existing project (dropping every
// field they just typed) would be a worse surprise than an error.
export async function createProject(input: NewProjectInput): Promise<Project> {
  const name = input.name.trim();
  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .insert({
      name,
      description: input.description?.trim() || null,
      start_date: input.start_date || null,
      owner: input.owner?.trim() || null,
      collaborators: input.collaborators?.trim() || null,
      focal_group: input.focal_group?.trim() || null,
      focal_region: input.focal_region?.trim() || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A project named "${name}" already exists.`);
    }
    throw new Error(error.message);
  }
  return data as Project;
}

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

export type SampleProjectLink = { sample_id: string; project_id: string };

// Every sample/project pairing — used to work out which samples belong to
// which project without an N+1 query per project.
export async function listSampleProjectLinks(): Promise<SampleProjectLink[]> {
  const { data, error } = await getSupabase().from(LINK_TABLE).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as SampleProjectLink[];
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
