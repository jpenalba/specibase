import { getSupabase } from "./supabase";

const TABLE = "project_bio_notes_blocks";

export type BioNotesBlock = {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  position: number;
  title: string;
  content: string;
};

export async function listBioNotesBlocks(projectId: string): Promise<BioNotesBlock[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioNotesBlock[];
}

// Appended after whatever's already there, same convention as
// appendSteps — a new entry always starts at the bottom of the notebook.
export async function addBioNotesBlock(
  projectId: string,
  title: string,
  content: string
): Promise<BioNotesBlock> {
  const existing = await listBioNotesBlocks(projectId);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({ project_id: projectId, title: title.trim(), content, position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioNotesBlock;
}

export type UpdateBioNotesBlockInput = { title?: string; content?: string };

// Editing a block only ever touches title/content — its created_at (the
// date shown on it) is set once, when it's added, and never moves just
// because the text was later fixed up.
export async function updateBioNotesBlock(
  id: string,
  input: UpdateBioNotesBlockInput
): Promise<BioNotesBlock> {
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
  return data as BioNotesBlock;
}

// Applies a full new ordering in one call, same as reorderSteps — the
// notebook's up/down controls always submit the complete ordering.
export async function reorderBioNotesBlocks(
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
