import { getSupabase } from "./supabase";
import { FocalGroupCategory } from "./focal-group";
import { LayerShape } from "./layer-shapes";
import { addMember } from "./project-members-store";

const PROJECTS_TABLE = "projects";
const LINK_TABLE = "sample_projects";
const PROTOCOL_LINK_TABLE = "protocol_projects";
const MEMBERS_TABLE = "project_members";

export type ProjectStatus = "in_progress" | "completed";

export type Project = {
  id: string;
  name: string;
  created_at: string;
  description: string | null;
  start_date: string | null;
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
  // Whether the map hides samples with no value for marker_style_field
  // instead of always showing them in a "(No value)" bucket.
  marker_hide_no_value: boolean;
  // Whether this project keeps an activity log — an Owner-only switch, set
  // via its own dedicated route rather than the general update flow below
  // (see src/lib/activity-log.ts's setProjectLoggingEnabled).
  log_enabled: boolean;
};

export type NewProjectInput = {
  name: string;
  description?: string;
  start_date?: string;
  focal_group?: string;
  focal_region?: string;
  logo?: FocalGroupCategory | null;
  status?: ProjectStatus;
  background?: string;
  notes?: string;
  marker_style_field?: string | null;
  marker_color?: string | null;
  marker_shape?: LayerShape | null;
  marker_hide_no_value?: boolean;
};

export type UpdateProjectInput = Partial<NewProjectInput>;

// Project names aren't globally unique any more (see
// supabase/migrations/0036_project_members.sql) — two different accounts
// can reuse the same name freely. What's still worth blocking is *one*
// account ending up with two same-named projects of their own, since
// that's confusing regardless of who else can also see either one. Scoped
// to every project `userId` is currently a member of, not just ones they
// own, since a same-named project shared with them would be just as
// confusing to pick between.
async function assertUniqueNameForUser(
  userId: string,
  name: string,
  excludeProjectId?: string
): Promise<void> {
  const { data, error } = await getSupabase()
    .from(MEMBERS_TABLE)
    .select("project_id, projects!inner(name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const collides = (data ?? []).some((row) => {
    if (excludeProjectId && row.project_id === excludeProjectId) return false;
    const project = row.projects as unknown as { name: string };
    return project.name === name;
  });
  if (collides) {
    throw new Error(`A project named "${name}" already exists.`);
  }
}

// Unlike getOrCreateProject() below, this always inserts a new row and
// fails if the name is taken — right for the dedicated projects page,
// where someone is deliberately filling out a full project profile and
// silently handing back a different, existing project (dropping every
// field they just typed) would be a worse surprise than an error.
// Creating a project makes `creatorId` its first Owner.
export async function createProject(input: NewProjectInput, creatorId: string): Promise<Project> {
  const name = input.name.trim();
  await assertUniqueNameForUser(creatorId, name);

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .insert({
      name,
      description: input.description?.trim() || null,
      start_date: input.start_date || null,
      focal_group: input.focal_group?.trim() || null,
      focal_region: input.focal_region?.trim() || null,
      logo: input.logo || null,
      status: input.status ?? "in_progress",
      background: input.background?.trim() || null,
      notes: input.notes?.trim() || null,
      marker_style_field: input.marker_style_field ?? null,
      marker_color: input.marker_color ?? null,
      marker_shape: input.marker_shape ?? null,
      marker_hide_no_value: input.marker_hide_no_value ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const project = data as Project;
  await addMember(project.id, creatorId, "owner");
  return project;
}

// Partial update — only fields present in `input` are changed. Used by the
// projects page's edit dialog, which always submits the full form, but
// written to tolerate a partial payload in case that ever changes.
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  actingUserId: string
): Promise<Project> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = input.name.trim();
    await assertUniqueNameForUser(actingUserId, patch.name as string, id);
  }
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.start_date !== undefined) patch.start_date = input.start_date || null;
  if (input.focal_group !== undefined) patch.focal_group = input.focal_group.trim() || null;
  if (input.focal_region !== undefined) patch.focal_region = input.focal_region.trim() || null;
  if (input.logo !== undefined) patch.logo = input.logo || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.background !== undefined) patch.background = input.background.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.marker_style_field !== undefined) patch.marker_style_field = input.marker_style_field;
  if (input.marker_color !== undefined) patch.marker_color = input.marker_color;
  if (input.marker_shape !== undefined) patch.marker_shape = input.marker_shape;
  if (input.marker_hide_no_value !== undefined) patch.marker_hide_no_value = input.marker_hide_no_value;

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

// Every project `userId` is a member of, regardless of role — replaces the
// old unscoped listProjects() now that projects are private to their
// members (see supabase/migrations/0036_project_members.sql).
export async function listProjectsForUser(userId: string): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from(MEMBERS_TABLE)
    .select("projects(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const projects = (data ?? []).map((row) => row.projects as unknown as Project);
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

// Creating a project with a name that already exists (among `creatorId`'s
// own projects — never a stranger's, now that projects are private to
// their members) just returns the existing one, rather than erroring —
// typing an existing project's name to add more samples to it is a normal
// thing to do here, not a conflict. Reports whether it actually created a
// new row, so callers (the activity log) only announce a creation when
// one actually happened.
export async function getOrCreateProject(
  name: string,
  creatorId: string
): Promise<{ project: Project; created: boolean }> {
  const trimmed = name.trim();
  const mine = await listProjectsForUser(creatorId);
  const existing = mine.find((p) => p.name === trimmed);
  if (existing) return { project: existing, created: false };

  const { data, error } = await getSupabase()
    .from(PROJECTS_TABLE)
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const project = data as Project;
  await addMember(project.id, creatorId, "owner");
  return { project, created: true };
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

export type ProtocolProjectLink = { protocol_id: string; project_id: string };

// Every protocol/project pairing — same shape as listSampleProjectLinks,
// used to work out which protocols are attached to which project.
export async function listProtocolProjectLinks(): Promise<ProtocolProjectLink[]> {
  const { data, error } = await getSupabase().from(PROTOCOL_LINK_TABLE).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProtocolProjectLink[];
}

// Links are upserted (ignore duplicates) since a protocol can already be
// attached to the project.
export async function linkProtocolsToProject(
  protocolIds: string[],
  projectId: string
): Promise<void> {
  if (protocolIds.length === 0) return;
  const rows = protocolIds.map((protocolId) => ({
    protocol_id: protocolId,
    project_id: projectId,
  }));
  const { error } = await getSupabase()
    .from(PROTOCOL_LINK_TABLE)
    .upsert(rows, { onConflict: "protocol_id,project_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function unlinkProtocolsFromProject(
  protocolIds: string[],
  projectId: string
): Promise<void> {
  if (protocolIds.length === 0) return;
  const { error } = await getSupabase()
    .from(PROTOCOL_LINK_TABLE)
    .delete()
    .eq("project_id", projectId)
    .in("protocol_id", protocolIds);
  if (error) throw new Error(error.message);
}
