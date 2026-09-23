import { getSupabase } from "./supabase";
import { FocalGroupCategory } from "./focal-group";
import { LayerShape } from "./layer-shapes";

const PROJECTS_TABLE = "projects";
const LINK_TABLE = "sample_projects";

export type ProjectStatus = "in_progress" | "completed";

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
  // An explicit icon choice — overrides auto-matching focal_group's text
  // (see @/lib/focal-group) when set. Null means keep auto-matching.
  logo: FocalGroupCategory | null;
  focal_region: string | null;
  status: ProjectStatus;
  // Free-form markdown shown in the Info tab — null means nothing's been
  // written yet for that section, which shows as an "Add background"/
  // "Add notes" button rather than empty rendered markdown.
  background: string | null;
  notes: string | null;
  // Samples-tab map styling. Null marker_style_field means "single style"
  // mode: every sample draws with marker_color/marker_shape (falling back
  // to the app's usual defaults when those are also null). A non-null
  // marker_style_field names a MARKER_STYLE_FIELDS key (see fields.ts) —
  // per-value overrides then live in project_marker_styles.
  marker_style_field: string | null;
  marker_color: string | null;
  marker_shape: LayerShape | null;
};

export type NewProjectInput = {
  name: string;
  description?: string;
  start_date?: string;
  owner?: string;
  collaborators?: string;
  focal_group?: string;
  focal_region?: string;
  logo?: FocalGroupCategory | null;
  status?: ProjectStatus;
  background?: string;
  notes?: string;
  marker_style_field?: string | null;
  marker_color?: string | null;
  marker_shape?: LayerShape | null;
};

export type UpdateProjectInput = Partial<NewProjectInput>;

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
      logo: input.logo || null,
      status: input.status ?? "in_progress",
      background: input.background?.trim() || null,
      notes: input.notes?.trim() || null,
      marker_style_field: input.marker_style_field ?? null,
      marker_color: input.marker_color ?? null,
      marker_shape: input.marker_shape ?? null,
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

// Partial update — only fields present in `input` are changed. Used by the
// projects page's edit dialog, which always submits the full form, but
// written to tolerate a partial payload in case that ever changes.
export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.start_date !== undefined) patch.start_date = input.start_date || null;
  if (input.owner !== undefined) patch.owner = input.owner.trim() || null;
  if (input.collaborators !== undefined) patch.collaborators = input.collaborators.trim() || null;
  if (input.focal_group !== undefined) patch.focal_group = input.focal_group.trim() || null;
  if (input.focal_region !== undefined) patch.focal_region = input.focal_region.trim() || null;
  if (input.logo !== undefined) patch.logo = input.logo || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.background !== undefined) patch.background = input.background.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.marker_style_field !== undefined) patch.marker_style_field = input.marker_style_field;
  if (input.marker_color !== undefined) patch.marker_color = input.marker_color;
  if (input.marker_shape !== undefined) patch.marker_shape = input.marker_shape;

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A project named "${patch.name}" already exists.`);
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
// Reports whether it actually created a new row, so callers (the activity
// log) only announce a creation when one actually happened.
export async function getOrCreateProject(
  name: string
): Promise<{ project: Project; created: boolean }> {
  const trimmed = name.trim();
  const { data: existing, error: lookupError } = await getSupabase()
    .from(PROJECTS_TABLE)
    .select("*")
    .eq("name", trimmed)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing) return { project: existing as Project, created: false };

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { project: data as Project, created: true };
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

export async function unlinkSamplesFromProject(
  sampleIds: string[],
  projectId: string
): Promise<void> {
  if (sampleIds.length === 0) return;
  const { error } = await getSupabase()
    .from(LINK_TABLE)
    .delete()
    .eq("project_id", projectId)
    .in("sample_id", sampleIds);
  if (error) throw new Error(error.message);
}
