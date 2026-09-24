import { getSupabase } from "./supabase";

const TABLE = "project_lab_notes_blocks";
const IMAGES_TABLE = "project_lab_note_images";

export type LabNotesBlock = {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  position: number;
  title: string;
  content: string;
};

export async function listLabNotesBlocks(projectId: string): Promise<LabNotesBlock[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LabNotesBlock[];
}

// Appended after whatever's already there, same convention as
// appendSteps — a new entry always starts at the bottom of the notebook.
export async function addLabNotesBlock(
  projectId: string,
  title: string,
  content: string
): Promise<LabNotesBlock> {
  const existing = await listLabNotesBlocks(projectId);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({ project_id: projectId, title: title.trim(), content, position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LabNotesBlock;
}

export type UpdateLabNotesBlockInput = { title?: string; content?: string };

// Editing a block only ever touches title/content — its created_at (the
// date shown on it) is set once, when it's added, and never moves just
// because the text was later fixed up.
export async function updateLabNotesBlock(
  id: string,
  input: UpdateLabNotesBlockInput
): Promise<LabNotesBlock> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.content !== undefined) patch.content = input.content;

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LabNotesBlock;
}

// Applies a full new ordering in one call, same as reorderSteps — the
// notebook's up/down controls always submit the complete ordering.
export async function reorderLabNotesBlocks(
  projectId: string,
  orderedBlockIds: string[]
): Promise<void> {
  const supabase = getSupabase();
  await Promise.all(
    orderedBlockIds.map((blockId, position) =>
      supabase.from(TABLE).update({ position }).eq("id", blockId).eq("project_id", projectId)
    )
  );
}

// An image attached to the Lab notes tab (a gel image, a trace, etc.) —
// its own button rather than embedded in a markdown block, since it
// carries structured metadata (a title, which sample(s) it's of, an
// optional caption) instead of just living inline in prose.
export type NoteImage = {
  id: string;
  project_id: string;
  created_at: string;
  title: string;
  notes: string | null;
  sample_ids: string[];
  image_url: string;
};

// Newest first — a gallery, not a chronological notebook, so a freshly
// added image shows up without scrolling.
export async function listLabNoteImages(projectId: string): Promise<NoteImage[]> {
  const { data, error } = await getSupabase()
    .from(IMAGES_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as NoteImage[];
}

export type NewNoteImageInput = {
  title: string;
  notes?: string;
  sample_ids?: string[];
  image_url: string;
};

export async function addLabNoteImage(
  projectId: string,
  input: NewNoteImageInput
): Promise<NoteImage> {
  const { data, error } = await getSupabase()
    .from(IMAGES_TABLE)
    .insert({
      project_id: projectId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      sample_ids: input.sample_ids ?? [],
      image_url: input.image_url,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as NoteImage;
}

export async function deleteLabNoteImage(id: string): Promise<void> {
  const { error } = await getSupabase().from(IMAGES_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
